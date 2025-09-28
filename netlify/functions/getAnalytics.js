// 获取真实的分析数据
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
    const { days = 30 } = event.queryStringParameters || {};

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // 1. 获取用户注册数据 (使用user_agent_relations表)
    const { data: users, error: usersError } = await supabase
      .from('user_agent_relations')
      .select('created_at, registration_source')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (usersError) {
      console.error('获取用户数据失败:', usersError);
    }

    // 2. 获取代理数据
    const { data: agents, error: agentsError } = await supabase
      .from('agent_profiles')
      .select('created_at, available_balance, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (agentsError) {
      console.error('获取代理数据失败:', agentsError);
    }

    // 3. 获取产品订单数据
    const { data: orders, error: ordersError } = await supabase
      .from('product_orders')
      .select('created_at, order_amount, product_type, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('获取订单数据失败:', ordersError);
    }

    // 4. 获取推广点击数据
    const { data: clicks, error: clicksError } = await supabase
      .from('promotion_clicks')
      .select('clicked_at, agent_id')
      .gte('clicked_at', startDate.toISOString())
      .lte('clicked_at', endDate.toISOString())
      .order('clicked_at', { ascending: true });

    if (clicksError) {
      console.error('获取点击数据失败:', clicksError);
    }

    // 5. 获取WhatsApp许可证数据 (使用whatsapp_activation_code表)
    const { data: licenses, error: licensesError } = await supabase
      .from('whatsapp_activation_code')
      .select('created_at, status, activation_date')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (licensesError) {
      console.error('获取许可证数据失败:', licensesError);
    }

    // 6. 处理数据并生成图表数据
    const analyticsData = processAnalyticsData({
      users: users || [],
      agents: agents || [],
      orders: orders || [],
      clicks: clicks || [],
      licenses: licenses || [],
      days: parseInt(days),
      startDate,
      endDate
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "分析数据获取成功",
        data: analyticsData
      }),
    };

  } catch (error) {
    console.error('获取分析数据函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};

// 处理分析数据的函数
function processAnalyticsData({ users, agents, orders, clicks, licenses, days, startDate, endDate }) {
  // 生成日期标签
  const labels = [];
  const dateMap = new Map();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const label = `${date.getMonth() + 1}-${date.getDate()}`;
    labels.push(label);
    dateMap.set(dateStr, i);
  }

  // 1. 用户注册趋势
  const userRegistrations = new Array(days).fill(0);
  users.forEach(user => {
    const dateStr = user.created_at.split('T')[0];
    const index = dateMap.get(dateStr);
    if (index !== undefined) {
      userRegistrations[index]++;
    }
  });

  // 2. 代理注册趋势
  const agentRegistrations = new Array(days).fill(0);
  agents.forEach(agent => {
    const dateStr = agent.created_at.split('T')[0];
    const index = dateMap.get(dateStr);
    if (index !== undefined) {
      agentRegistrations[index]++;
    }
  });

  // 3. 收入趋势
  const revenueData = new Array(days).fill(0);
  orders.forEach(order => {
    if (order.status === 'paid') {
      const dateStr = order.created_at.split('T')[0];
      const index = dateMap.get(dateStr);
      if (index !== undefined) {
        revenueData[index] += order.order_amount || 0;
      }
    }
  });

  // 4. 推广点击趋势
  const clickData = new Array(days).fill(0);
  clicks.forEach(click => {
    const dateStr = click.clicked_at.split('T')[0];
    const index = dateMap.get(dateStr);
    if (index !== undefined) {
      clickData[index]++;
    }
  });

  // 5. 许可证激活趋势
  const licenseActivations = new Array(days).fill(0);
  licenses.forEach(license => {
    if (license.activation_date) {
      const dateStr = license.activation_date.split('T')[0];
      const index = dateMap.get(dateStr);
      if (index !== undefined) {
        licenseActivations[index]++;
      }
    }
  });

  // 6. 产品收入占比
  const productRevenue = {
    'google-maps': 0,
    'email-filter': 0,
    'whatsapp-filter': 0
  };
  
  orders.forEach(order => {
    if (order.status === 'paid' && productRevenue.hasOwnProperty(order.product_type)) {
      productRevenue[order.product_type] += order.order_amount || 0;
    }
  });

  // 7. 用户注册来源分布
  const userTypeDistribution = {
    'agent_invite': 0,
    'direct': 0,
    'admin': 0
  };
  
  users.forEach(user => {
    if (userTypeDistribution.hasOwnProperty(user.registration_source)) {
      userTypeDistribution[user.registration_source]++;
    }
  });

  // 8. 计算关键指标
  const totalUsers = users.length;
  const totalAgents = agents.length;
  const totalRevenue = orders
    .filter(order => order.status === 'paid')
    .reduce((sum, order) => sum + (order.order_amount || 0), 0);
  const totalClicks = clicks.length;
  const totalOrders = orders.filter(order => order.status === 'paid').length;
  const conversionRate = totalClicks > 0 ? (totalOrders / totalClicks * 100).toFixed(2) : 0;

  // 9. 活跃代理统计
  const activeAgents = agents.filter(agent => agent.status === 'active').length;
  const totalAgentBalance = agents.reduce((sum, agent) => sum + (agent.available_balance || 0), 0);

  return {
    labels,
    trends: {
      userRegistrations,
      agentRegistrations,
      revenue: revenueData,
      clicks: clickData,
      licenseActivations
    },
    distributions: {
      productRevenue,
      userTypeDistribution
    },
    metrics: {
      totalUsers,
      totalAgents,
      totalRevenue,
      totalClicks,
      totalOrders,
      conversionRate,
      activeAgents,
      totalAgentBalance
    },
    summary: {
      avgDailyUsers: (totalUsers / days).toFixed(1),
      avgDailyRevenue: (totalRevenue / days).toFixed(2),
      avgDailyClicks: (totalClicks / days).toFixed(1),
      topProduct: Object.keys(productRevenue).reduce((a, b) => 
        productRevenue[a] > productRevenue[b] ? a : b
      )
    }
  };
}
