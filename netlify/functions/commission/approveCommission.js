// 管理员审核佣金
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
      commissionIds, // 佣金记录ID数组
      action, // 'approve' 或 'reject'
      adminNotes,
      adminUserId
    } = JSON.parse(event.body || '{}');

    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '佣金记录ID不能为空' 
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
            message: '只有管理员才能审核佣金' 
          }),
        };
      }
    }

    // 2. 获取待审核的佣金记录
    const { data: commissionRecords, error: fetchError } = await supabase
      .from('commission_records')
      .select(`
        *,
        agent:agent_profiles(
          id,
          user_id,
          real_name,
          agent_code,
          available_balance,
          total_commission
        ),
        order:orders(
          order_number,
          product_name,
          amount
        )
      `)
      .in('id', commissionIds)
      .eq('status', 'pending');

    if (fetchError) {
      console.error('获取佣金记录失败:', fetchError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '获取佣金记录失败: ' + fetchError.message 
        }),
      };
    }

    if (!commissionRecords || commissionRecords.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '未找到待审核的佣金记录' 
        }),
      };
    }

    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // 3. 更新佣金记录状态
    const { data: updatedRecords, error: updateError } = await supabase
      .from('commission_records')
      .update({
        status: newStatus,
        admin_notes: adminNotes,
        approved_by: adminUserId,
        approved_at: now,
        updated_at: now
      })
      .in('id', commissionIds)
      .select();

    if (updateError) {
      console.error('更新佣金记录失败:', updateError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '更新佣金记录失败: ' + updateError.message 
        }),
      };
    }

    // 4. 如果审核通过，更新代理的余额和总佣金
    if (action === 'approve') {
      for (const record of commissionRecords) {
        const agent = record.agent;
        const commissionAmount = parseFloat(record.commission_amount);
        
        // 更新代理的可用余额和总佣金
        const { error: balanceError } = await supabase
          .from('agent_profiles')
          .update({
            available_balance: (parseFloat(agent.available_balance) + commissionAmount).toFixed(2),
            total_commission: (parseFloat(agent.total_commission) + commissionAmount).toFixed(2),
            updated_at: now
          })
          .eq('id', agent.id);

        if (balanceError) {
          console.error(`更新代理 ${agent.id} 余额失败:`, balanceError);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: `佣金${action === 'approve' ? '审核通过' : '审核拒绝'}成功`,
        data: {
          updatedCount: updatedRecords.length,
          records: updatedRecords
        }
      }),
    };

  } catch (error) {
    console.error('审核佣金函数出错:', error);
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
