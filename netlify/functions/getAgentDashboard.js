// 获取代理仪表板数据
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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: '只支持 GET 请求' }),
    };
  }

  try {
    // 从查询参数获取用户ID
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '用户ID不能为空' 
        }),
      };
    }

    // 1. 获取代理基本信息
    const { data: agentProfile, error: agentError } = await supabase
      .from('agent_profiles')
      .select(`
        *,
        parent_agent:agent_profiles!parent_agent_id(agent_code, real_name)
      `)
      .eq('user_id', userId)
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

    // 2. 获取下级代理数量
    const { count: subAgentsCount } = await supabase
      .from('agent_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('parent_agent_id', agentProfile.id);

    // 3. 获取团队总人数（包括所有下级）
    const { data: teamMembers } = await supabase
      .from('agent_hierarchy')
      .select(`
        agent:agent_profiles!agent_id(
          id,
          real_name,
          agent_code,
          level,
          total_commission,
          created_at
        )
      `)
      .eq('parent_agent_id', agentProfile.id);

    // 4. 获取本月佣金统计
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const { data: monthlyCommissions } = await supabase
      .from('product_orders')
      .select('commission_amount')
      .eq('agent_id', agentProfile.id)
      .eq('status', 'paid')
      .gte('created_at', currentMonth.toISOString());

    const monthlyCommission = monthlyCommissions?.reduce((sum, record) => 
      sum + parseFloat(record.commission_amount), 0) || 0;

    // 5. 获取待审核佣金
    const { data: pendingCommissions } = await supabase
      .from('product_orders')
      .select(`
        *,
        order:orders(
          id,
          out_trade_no,
          product_id,
          customer_email,
          status
        )
      `)
      .eq('agent_id', agentProfile.id)
      .eq('status', 'pending');

    const pendingCommissionAmount = pendingCommissions?.reduce((sum, record) => 
      sum + parseFloat(record.commission_amount), 0) || 0;

    // 6. 获取提现记录
    const { data: withdrawalRequests } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('agent_id', agentProfile.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // 7. 获取最近订单（通过产品订单表）
    const { data: recentOrders } = await supabase
      .from('product_orders')
      .select('*')
      .eq('agent_id', agentProfile.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // 7.1. 获取所有订单用于统计计算
    const { data: allOrders } = await supabase
      .from('product_orders')
      .select('commission_amount')
      .eq('agent_id', agentProfile.id);

    // 8. 获取推广点击量统计
    const { data: promotionClicks } = await supabase
      .from('promotion_clicks')
      .select('*')
      .eq('agent_id', agentProfile.id)
      .order('clicked_at', { ascending: false });

    // 9. 获取推广记录统计
    const { data: promotionStats } = await supabase
      .from('product_promotions')
      .select('clicks_count, conversions_count, total_commission')
      .eq('agent_id', agentProfile.id);

    // 计算推广统计数据
    const totalClicks = promotionClicks?.length || 0;
    // 从product_orders表计算实际转化数和佣金
    const totalConversions = allOrders?.length || 0;
    const totalPromotionCommission = allOrders?.reduce((sum, order) => sum + parseFloat(order.commission_amount || 0), 0) || 0;

    // 10. 获取今日点击量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayClicks } = await supabase
      .from('promotion_clicks')
      .select('*')
      .eq('agent_id', agentProfile.id)
      .gte('clicked_at', today.toISOString());

    const todayClicksCount = todayClicks?.length || 0;

    // 11. 计算统计数据
    const stats = {
      totalCommission: parseFloat(agentProfile.total_commission) || 0,
      availableBalance: parseFloat(agentProfile.available_balance) || 0,
      monthlyCommission: monthlyCommission,
      pendingCommission: pendingCommissionAmount,
      subAgentsCount: subAgentsCount || 0,
      teamMembersCount: teamMembers?.length || 0,
      // 推广统计数据
      totalClicks: totalClicks,
      totalConversions: totalConversions,
      totalPromotionCommission: totalPromotionCommission,
      todayClicks: todayClicksCount
    };

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        data: {
          agentProfile,
          stats,
          teamMembers: teamMembers?.map(member => member.agent) || [],
          pendingCommissions: pendingCommissions || [],
          withdrawalRequests: withdrawalRequests || [],
          recentOrders: recentOrders || [],
          promotionClicks: promotionClicks || [],
          promotionStats: promotionStats || []
        }
      }),
    };

  } catch (error) {
    console.error('获取代理仪表板数据出错:', error);
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
