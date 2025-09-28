// 生成产品推广链接
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 产品配置
const PRODUCTS = {
  'google-maps': {
    name: '谷歌地图拓客程序',
    websiteId: 'maps-scraper',
    baseUrl: '/product.html?id=maps-scraper',
    checkoutUrl: '/checkout.html',
    commissionRate: 0.20, // 20%
    description: '智能数据抓取，精准客户获取'
  },
  'email-filter': {
    name: '邮件过滤程序',
    websiteId: 'email-validator',
    baseUrl: '/product.html?id=email-validator',
    checkoutUrl: '/checkout.html',
    commissionRate: 0.15, // 15%
    description: '高效邮件验证，提升营销效果'
  },
  'whatsapp-filter': {
    name: 'WhatsApp过滤程序',
    websiteId: 'whatsapp-validator',
    baseUrl: '/product.html?id=whatsapp-validator',
    checkoutUrl: '/checkout.html',
    commissionRate: 0.18, // 18%
    description: 'WhatsApp号码验证，精准营销'
  }
};

exports.handler = async function (event, context) {
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

  try {
    const { productType, agentId } = JSON.parse(event.body || '{}');

    if (!productType || !agentId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "产品类型和代理ID不能为空" }),
      };
    }

    // 验证产品类型
    if (!PRODUCTS[productType]) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "无效的产品类型" }),
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

    // 2. 生成推广码
    const promotionCode = `${agent.agent_code}_${productType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // 3. 设置过期时间（30天）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 4. 创建推广记录
    const { data: promotion, error: promotionError } = await supabase
      .from('product_promotions')
      .insert([{
        agent_id: agentId,
        product_type: productType,
        promotion_code: promotionCode,
        commission_rate: PRODUCTS[productType].commissionRate,
        status: 'active',
        expires_at: expiresAt.toISOString()
      }])
      .select()
      .single();

    if (promotionError) {
      console.error('创建推广记录失败:', promotionError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "生成推广链接失败" }),
      };
    }

    // 5. 生成推广链接
    const websiteUrl = process.env.WEBSITE_URL || 'https://mediamingle.cn'; // MediaMingle官网地址
    const productInfo = PRODUCTS[productType];
    const promotionLink = `${websiteUrl}${productInfo.baseUrl}&ref=${promotionCode}`;
    const checkoutLink = `${websiteUrl}${productInfo.checkoutUrl}?ref=${promotionCode}`;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "产品推广链接生成成功",
        data: {
          productType: productType,
          productName: productInfo.name,
          promotionCode: promotionCode,
          productLink: promotionLink,
          checkoutLink: checkoutLink,
          commissionRate: productInfo.commissionRate,
          expiresAt: expiresAt.toISOString(),
          agentCode: agent.agent_code
        }
      }),
    };

  } catch (error) {
    console.error('生成产品推广链接函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
