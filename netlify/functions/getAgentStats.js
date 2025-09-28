const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  // CORS 预检请求处理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  try {
    const { agentId } = event.queryStringParameters || {};

    if (!agentId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "代理ID不能为空" }),
      };
    }

    // 1. 获取代理基本信息
    const { data: agent, error: agentError } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "代理不存在" }),
      };
    }

    // 2. 统计推广用户数量
    const { data: userAgentRelations, error: relationsError } = await supabase
      .from('user_agent_relations')
      .select('*')
      .eq('agent_id', agentId);

    if (relationsError) {
      console.error('查询用户代理关系失败:', relationsError);
    }

    // 获取用户信息
    let promotedUsers = [];
    if (userAgentRelations && userAgentRelations.length > 0) {
      const userIds = userAgentRelations.map(relation => relation.user_id);
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) {
        console.error('查询用户信息失败:', usersError);
      } else {
        // 匹配用户信息
        promotedUsers = userAgentRelations.map(relation => {
          const user = users.users.find(u => u.id === relation.user_id);
          return {
            ...relation,
            user: user ? {
              email: user.email,
              created_at: user.created_at
            } : null
          };
        });
      }
    }

    // 3. 统计下级代理数量
    const { data: subAgents, error: agentsError } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('parent_agent_id', agentId);

    if (agentsError) {
      console.error('查询下级代理失败:', agentsError);
    }

    // 4. 统计佣金记录
    const { data: commissions, error: commissionError } = await supabase
      .from('commission_records')
      .select('*')
      .eq('agent_id', agentId);

    if (commissionError) {
      console.error('查询佣金记录失败:', commissionError);
    }

    // 5. 计算统计数据
    const totalPromotedUsers = promotedUsers?.length || 0;
    const totalSubAgents = subAgents?.length || 0;
    const totalCommissions = commissions?.reduce((sum, record) => sum + parseFloat(record.commission_amount || 0), 0) || 0;
    const pendingCommissions = commissions?.filter(record => record.status === 'pending').length || 0;
    const approvedCommissions = commissions?.filter(record => record.status === 'approved').length || 0;

    // 6. 按时间统计（最近30天）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = promotedUsers?.filter(user => 
      new Date(user.user.created_at) > thirtyDaysAgo
    ).length || 0;

    const recentCommissions = commissions?.filter(record => 
      new Date(record.created_at) > thirtyDaysAgo
    ).reduce((sum, record) => sum + parseFloat(record.commission_amount || 0), 0) || 0;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "代理统计数据获取成功",
        data: {
          agent: {
            id: agent.id,
            agentCode: agent.agent_code,
            level: agent.level,
            commissionRate: agent.commission_rate,
            totalCommission: agent.total_commission,
            availableBalance: agent.available_balance
          },
          stats: {
            totalPromotedUsers,
            totalSubAgents,
            totalCommissions,
            pendingCommissions,
            approvedCommissions,
            recentUsers,
            recentCommissions
          },
          promotedUsers: promotedUsers?.map(user => ({
            id: user.id,
            email: user.user.email,
            registrationDate: user.user.created_at,
            inviteCode: user.invite_code
          })) || [],
          subAgents: subAgents?.map(agent => ({
            id: agent.id,
            agentCode: agent.agent_code,
            level: agent.level,
            created_at: agent.created_at
          })) || []
        }
      }),
    };

  } catch (error) {
    console.error('获取代理统计函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
