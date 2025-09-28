// 代理申请提现
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 获取系统配置
async function getSystemConfig(key) {
  const { data: config } = await supabase
    .from('system_config')
    .select('config_value')
    .eq('config_key', key)
    .single();

  return config?.config_value || null;
}

exports.handler = async (event, context) => {
  // CORS 预检请求处理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: '只支持 POST 请求' }),
    };
  }

  try {
    const {
      agentUserId,
      amount,
      alipayAccount,
      realName
    } = JSON.parse(event.body || '{}');

    if (!agentUserId || !amount || !alipayAccount || !realName) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '代理用户ID、提现金额、支付宝账号和真实姓名不能为空' 
        }),
      };
    }

    const withdrawalAmount = parseFloat(amount);

    // 1. 验证代理身份
    const { data: agentProfile, error: agentError } = await supabase
      .from('agent_profiles')
      .select('id, real_name, alipay_account, available_balance, status')
      .eq('user_id', agentUserId)
      .single();

    if (agentError || !agentProfile) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '代理信息不存在' 
        }),
      };
    }

    // 2. 检查代理状态
    if (agentProfile.status !== 'active') {
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '代理账户状态异常，无法申请提现' 
        }),
      };
    }

    // 3. 验证提现金额
    const availableBalance = parseFloat(agentProfile.available_balance);
    
    if (withdrawalAmount <= 0) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '提现金额必须大于0' 
        }),
      };
    }

    if (withdrawalAmount > availableBalance) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '提现金额不能超过可用余额' 
        }),
      };
    }

    // 4. 获取系统配置
    const minWithdrawalConfig = await getSystemConfig('min_withdrawal_amount');
    const maxWithdrawalConfig = await getSystemConfig('max_withdrawal_amount');
    const feeRateConfig = await getSystemConfig('withdrawal_fee_rate');

    const minAmount = minWithdrawalConfig?.amount || 100.00;
    const maxAmount = maxWithdrawalConfig?.amount || 50000.00;
    const feeRate = feeRateConfig?.rate || 0.00;

    if (withdrawalAmount < minAmount) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: `提现金额不能少于 ${minAmount} 元` 
        }),
      };
    }

    if (withdrawalAmount > maxAmount) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: `提现金额不能超过 ${maxAmount} 元` 
        }),
      };
    }

    // 5. 检查是否有待处理的提现申请
    const { data: pendingWithdrawal } = await supabase
      .from('withdrawal_requests')
      .select('id')
      .eq('agent_id', agentProfile.id)
      .eq('status', 'pending')
      .single();

    if (pendingWithdrawal) {
      return {
        statusCode: 409,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '您已有待处理的提现申请，请等待处理完成后再申请' 
        }),
      };
    }

    // 6. 计算手续费
    const feeAmount = (withdrawalAmount * feeRate) / 100;
    const actualAmount = withdrawalAmount - feeAmount;

    // 7. 创建提现申请
    const { data: withdrawalRequest, error: createError } = await supabase
      .from('withdrawal_requests')
      .insert([{
        agent_id: agentProfile.id,
        amount: withdrawalAmount.toFixed(2),
        alipay_account: alipayAccount,
        real_name: realName,
        status: 'pending'
      }])
      .select()
      .single();

    if (createError) {
      console.error('创建提现申请失败:', createError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '创建提现申请失败: ' + createError.message 
        }),
      };
    }

    // 8. 冻结提现金额（从可用余额中扣除）
    const newAvailableBalance = (availableBalance - withdrawalAmount).toFixed(2);
    
    const { error: balanceError } = await supabase
      .from('agent_profiles')
      .update({
        available_balance: newAvailableBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentProfile.id);

    if (balanceError) {
      console.error('更新代理余额失败:', balanceError);
      // 回滚：删除提现申请
      await supabase
        .from('withdrawal_requests')
        .delete()
        .eq('id', withdrawalRequest.id);
      
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '更新余额失败，提现申请已取消' 
        }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: '提现申请提交成功，等待管理员审核',
        data: {
          withdrawalId: withdrawalRequest.id,
          amount: withdrawalAmount.toFixed(2),
          feeAmount: feeAmount.toFixed(2),
          actualAmount: actualAmount.toFixed(2),
          newAvailableBalance: newAvailableBalance
        }
      }),
    };

  } catch (error) {
    console.error('申请提现函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        success: false, 
        message: '服务器内部错误', 
        error: error.message 
      }),
    };
  }
};
