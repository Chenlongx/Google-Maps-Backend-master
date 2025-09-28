// 管理员处理提现申请（审核通过后自动通过支付宝发放）
const { createClient } = require('@supabase/supabase-js');
const AlipaySdk = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 初始化支付宝SDK
const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.ALIPAY_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
  signType: 'RSA2',
});

// 支付宝转账到个人账户
async function transferToAlipay(amount, alipayAccount, realName, orderId) {
  try {
    const formData = new AlipayFormData();
    formData.setMethod('get');
    
    formData.addField('bizContent', {
      out_biz_no: orderId, // 商户转账唯一订单号
      payee_type: 'ALIPAY_LOGONID', // 收款方账户类型
      payee_account: alipayAccount, // 收款方账户
      amount: amount, // 转账金额
      payee_real_name: realName, // 收款方真实姓名
      remark: '代理佣金提现', // 转账备注
    });
    
    formData.addField('notifyUrl', process.env.ALIPAY_NOTIFY_URL);
    
    const result = await alipaySdk.exec(
      'alipay.fund.trans.toaccount.transfer',
      {},
      { formData: formData }
    );
    
    return result;
  } catch (error) {
    console.error('支付宝转账失败:', error);
    throw error;
  }
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
      withdrawalIds, // 提现申请ID数组
      action, // 'approve' 或 'reject'
      adminNotes,
      adminUserId
    } = JSON.parse(event.body || '{}');

    if (!withdrawalIds || !Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '提现申请ID不能为空' 
        }),
      };
    }

    if (!['approve', 'reject'].includes(action)) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '操作类型必须是 approve 或 reject' 
        }),
      };
    }

    // 1. 验证管理员权限
    if (adminUserId) {
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role_name')
        .eq('user_id', adminUserId)
        .eq('role_name', 'admin')
        .single();

      if (!adminRole) {
        return {
          statusCode: 403,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ 
            success: false, 
            message: '只有管理员才能处理提现申请' 
          }),
        };
      }
    }

    // 2. 获取待处理的提现申请
    const { data: withdrawalRequests, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        agent:agent_profiles(
          id,
          real_name,
          agent_code,
          available_balance
        )
      `)
      .in('id', withdrawalIds)
      .eq('status', 'pending');

    if (fetchError) {
      console.error('获取提现申请失败:', fetchError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '获取提现申请失败: ' + fetchError.message 
        }),
      };
    }

    if (!withdrawalRequests || withdrawalRequests.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '未找到待处理的提现申请' 
        }),
      };
    }

    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'paid' : 'rejected';
    const processedResults = [];

    // 3. 处理每个提现申请
    for (const request of withdrawalRequests) {
      try {
        if (action === 'approve') {
          // 审核通过，调用支付宝转账
          const transferResult = await transferToAlipay(
            request.amount,
            request.alipay_account,
            request.real_name,
            `WD${request.id}${Date.now()}`
          );

          // 更新提现申请状态
          const { data: updatedRequest, error: updateError } = await supabase
            .from('withdrawal_requests')
            .update({
              status: 'paid',
              admin_notes: adminNotes,
              processed_by: adminUserId,
              processed_at: now,
              alipay_transaction_id: transferResult.out_biz_no || transferResult.order_id,
              updated_at: now
            })
            .eq('id', request.id)
            .select()
            .single();

          if (updateError) {
            console.error(`更新提现申请 ${request.id} 失败:`, updateError);
            processedResults.push({
              id: request.id,
              success: false,
              message: '更新状态失败'
            });
          } else {
            processedResults.push({
              id: request.id,
              success: true,
              message: '提现成功',
              alipayTransactionId: transferResult.out_biz_no || transferResult.order_id
            });
          }
        } else {
          // 审核拒绝，恢复代理余额
          const { error: balanceError } = await supabase
            .from('agent_profiles')
            .update({
              available_balance: (parseFloat(request.agent.available_balance) + parseFloat(request.amount)).toFixed(2),
              updated_at: now
            })
            .eq('id', request.agent.id);

          if (balanceError) {
            console.error(`恢复代理 ${request.agent.id} 余额失败:`, balanceError);
          }

          // 更新提现申请状态
          const { data: updatedRequest, error: updateError } = await supabase
            .from('withdrawal_requests')
            .update({
              status: 'rejected',
              admin_notes: adminNotes,
              processed_by: adminUserId,
              processed_at: now,
              updated_at: now
            })
            .eq('id', request.id)
            .select()
            .single();

          if (updateError) {
            console.error(`更新提现申请 ${request.id} 失败:`, updateError);
            processedResults.push({
              id: request.id,
              success: false,
              message: '更新状态失败'
            });
          } else {
            processedResults.push({
              id: request.id,
              success: true,
              message: '提现申请已拒绝，余额已恢复'
            });
          }
        }
      } catch (error) {
        console.error(`处理提现申请 ${request.id} 失败:`, error);
        processedResults.push({
          id: request.id,
          success: false,
          message: error.message || '处理失败'
        });
      }
    }

    const successCount = processedResults.filter(r => r.success).length;
    const failCount = processedResults.filter(r => !r.success).length;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: `提现处理完成，成功 ${successCount} 个，失败 ${failCount} 个`,
        data: {
          totalCount: withdrawalRequests.length,
          successCount: successCount,
          failCount: failCount,
          results: processedResults
        }
      }),
    };

  } catch (error) {
    console.error('处理提现申请函数出错:', error);
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
