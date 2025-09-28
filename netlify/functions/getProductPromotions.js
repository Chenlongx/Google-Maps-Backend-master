// 获取代理产品推广数据
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

    // 1. 验证代理是否存在
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

    // 2. 获取推广记录统计
    const { data: promotions, error: promotionsError } = await supabase
      .from('product_promotions')
      .select('*')
      .eq('agent_id', agentId);

    if (promotionsError) {
      console.error('查询推广记录失败:', promotionsError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "查询推广记录失败" }),
      };
    }

    // 3. 获取点击统计
    const { data: clicks, error: clicksError } = await supabase
      .from('promotion_clicks')
      .select('*')
      .eq('agent_id', agentId);

    if (clicksError) {
      console.error('查询点击记录失败:', clicksError);
    }

    // 4. 获取订单统计
    const { data: orders, error: ordersError } = await supabase
      .from('product_orders')
      .select('*')
      .eq('agent_id', agentId);

    if (ordersError) {
      console.error('查询订单记录失败:', ordersError);
    }

    // 5. 计算统计数据
    const totalPromotions = promotions ? promotions.length : 0;
    const totalClicks = clicks ? clicks.length : 0;
    const totalConversions = orders ? orders.filter(order => order.status === 'paid').length : 0;
    const totalCommissions = orders ? orders
      .filter(order => order.status === 'paid')
      .reduce((sum, order) => sum + (order.commission_amount || 0), 0) : 0;

    // 6. 按产品类型分组统计
    const productStats = {};
    if (promotions) {
      promotions.forEach(promotion => {
        const productType = promotion.product_type;
        if (!productStats[productType]) {
          productStats[productType] = {
            promotions: 0,
            clicks: 0,
            conversions: 0,
            commissions: 0
          };
        }
        productStats[productType].promotions++;
      });
    }

    // 按产品类型统计点击
    if (clicks) {
      clicks.forEach(click => {
        const promotion = promotions?.find(p => p.promotion_code === click.promotion_code);
        if (promotion) {
          const productType = promotion.product_type;
          if (productStats[productType]) {
            productStats[productType].clicks++;
          }
        }
      });
    }

    // 按产品类型统计转化和佣金
    if (orders) {
      orders.forEach(order => {
        if (order.status === 'paid') {
          const promotion = promotions?.find(p => p.promotion_code === order.promotion_code);
          if (promotion) {
            const productType = promotion.product_type;
            if (productStats[productType]) {
              productStats[productType].conversions++;
              productStats[productType].commissions += order.commission_amount || 0;
            }
          }
        }
      });
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "产品推广数据获取成功",
        data: {
          totalPromotions,
          totalClicks,
          totalConversions,
          totalCommissions,
          productStats,
          promotions: promotions || [],
          recentOrders: orders ? orders.slice(0, 10) : [] // 最近10个订单
        }
      }),
    };

  } catch (error) {
    console.error('获取产品推广数据函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
