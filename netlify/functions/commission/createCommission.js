// 创建佣金记录（客户下单后自动生成）
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 递归查找所有上级代理
async function findParentAgents(agentId, level = 1) {
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('parent_agent_id, commission_rate')
    .eq('id', agentId)
    .single();

  if (!agent || !agent.parent_agent_id) {
    return [];
  }

  const parentAgents = await findParentAgents(agent.parent_agent_id, level + 1);
  return [
    { agentId: agent.parent_agent_id, level: level, commissionRate: agent.commission_rate },
    ...parentAgents
  ];
}

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
      orderId,
      customerEmail,
      orderAmount,
      productId,
      outTradeNo
    } = JSON.parse(event.body || '{}');

    if (!orderId || !customerEmail || !orderAmount) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '订单ID、客户邮箱和订单金额不能为空' 
        }),
      };
    }

    // 1. 查找客户的推荐代理
    const { data: customerInvitation } = await supabase
      .from('invitations')
      .select(`
        inviter_agent_id,
        agent:agent_profiles!inviter_agent_id(
          id,
          agent_code,
          commission_rate,
          level
        )
      `)
      .eq('invitee_email', customerEmail)
      .eq('status', 'accepted')
      .single();

    if (!customerInvitation) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: true,
          message: '该客户没有推荐代理，无需生成佣金',
          data: { commissionCount: 0 }
        }),
      };
    }

    const rootAgent = customerInvitation.agent;
    const orderAmountFloat = parseFloat(orderAmount);

    // 2. 获取系统分佣配置
    const agentLevelsConfig = await getSystemConfig('agent_levels');
    const defaultCommissionRate = await getSystemConfig('default_commission_rate');
    
    const defaultRate = defaultCommissionRate?.rate || 10.00;
    const levelConfigs = agentLevelsConfig?.levels || [
      { level: 1, rate: 10.00 },
      { level: 2, rate: 5.00 },
      { level: 3, rate: 2.00 }
    ];

    // 3. 查找所有上级代理
    const parentAgents = await findParentAgents(rootAgent.id);
    const allAgents = [
      { agentId: rootAgent.id, level: 1, commissionRate: rootAgent.commission_rate },
      ...parentAgents
    ];

    // 4. 为每个代理创建佣金记录
    const commissionRecords = [];
    let totalCommission = 0;

    for (const agentInfo of allAgents) {
      // 获取代理信息
      const { data: agent } = await supabase
        .from('agent_profiles')
        .select('id, agent_code, real_name, commission_rate')
        .eq('id', agentInfo.agentId)
        .single();

      if (!agent) continue;

      // 计算佣金比例
      let commissionRate = agentInfo.commissionRate || defaultRate;
      
      // 如果代理没有设置佣金比例，使用系统配置
      if (!commissionRate) {
        const levelConfig = levelConfigs.find(config => config.level === agentInfo.level);
        commissionRate = levelConfig?.rate || defaultRate;
      }

      // 计算佣金金额
      const commissionAmount = (orderAmountFloat * commissionRate) / 100;

      if (commissionAmount > 0) {
        commissionRecords.push({
          order_id: orderId,
          agent_id: agent.id,
          commission_amount: commissionAmount.toFixed(2),
          commission_rate: commissionRate,
          status: 'pending'
        });

        totalCommission += commissionAmount;
      }
    }

    // 5. 批量插入佣金记录
    if (commissionRecords.length > 0) {
      const { data: insertedRecords, error: insertError } = await supabase
        .from('commission_records')
        .insert(commissionRecords)
        .select();

      if (insertError) {
        console.error('插入佣金记录失败:', insertError);
        return {
          statusCode: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ 
            success: false, 
            message: '创建佣金记录失败: ' + insertError.message 
          }),
        };
      }

      return {
        statusCode: 201,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: true,
          message: '佣金记录创建成功',
          data: {
            commissionCount: commissionRecords.length,
            totalCommission: totalCommission.toFixed(2),
            records: insertedRecords
          }
        }),
      };
    } else {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: true,
          message: '无需创建佣金记录',
          data: { commissionCount: 0 }
        }),
      };
    }

  } catch (error) {
    console.error('创建佣金记录函数出错:', error);
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
