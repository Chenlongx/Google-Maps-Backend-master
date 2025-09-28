// 处理订单和佣金计算
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
  'maps-scraper': {
    name: '谷歌地图拓客程序',
    internalType: 'google-maps',
    commissionRate: 0.20
  },
  'email-validator': {
    name: '邮件过滤程序',
    internalType: 'email-filter',
    commissionRate: 0.15
  },
  'whatsapp-validator': {
    name: 'WhatsApp过滤程序',
    internalType: 'whatsapp-filter',
    commissionRate: 0.18
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
    const { 
      customerEmail,
      productId,
      orderAmount,
      paymentMethod,
      paymentId,
      referralCode,
      agentCode
    } = JSON.parse(event.body || '{}');

    if (!customerEmail || !productId || !orderAmount) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "客户邮箱、产品ID和订单金额不能为空" }),
      };
    }

    // 1. 获取产品信息
    const productInfo = PRODUCTS[productId];
    if (!productInfo) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "无效的产品ID" }),
      };
    }

    // 2. 查找代理信息
    let agentId = null;
    let commissionAmount = 0;

    if (referralCode || agentCode) {
      // 通过推广码查找代理
      if (referralCode) {
        const { data: promotion, error: promotionError } = await supabase
          .from('product_promotions')
          .select('agent_id, commission_rate')
          .eq('promotion_code', referralCode)
          .single();

        if (!promotionError && promotion) {
          agentId = promotion.agent_id;
          commissionAmount = orderAmount * promotion.commission_rate;
        }
      }

      // 通过代理代码查找代理
      if (!agentId && agentCode) {
        const { data: agent, error: agentError } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('agent_code', agentCode)
          .single();

        if (!agentError && agent) {
          agentId = agent.id;
          commissionAmount = orderAmount * productInfo.commissionRate;
        }
      }
    }

    // 3. 创建订单记录
    const { data: order, error: orderError } = await supabase
      .from('product_orders')
      .insert([{
        customer_email: customerEmail,
        product_type: productInfo.internalType,
        promotion_code: referralCode,
        order_amount: orderAmount,
        commission_amount: commissionAmount,
        agent_id: agentId,
        status: 'paid',
        payment_method: paymentMethod,
        payment_id: paymentId
      }])
      .select()
      .single();

    if (orderError) {
      console.error('创建订单失败:', orderError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "创建订单失败" }),
      };
    }

    // 4. 如果有代理，更新推广记录和代理统计
    if (agentId && commissionAmount > 0) {
      // 更新推广记录的转化次数和佣金
      if (referralCode) {
        const { error: updatePromotionError } = await supabase
          .from('product_promotions')
          .update({ 
            conversions_count: supabase.sql`conversions_count + 1`,
            total_commission: supabase.sql`total_commission + ${commissionAmount}`,
            updated_at: new Date().toISOString()
          })
          .eq('promotion_code', referralCode);

        if (updatePromotionError) {
          console.error('更新推广记录失败:', updatePromotionError);
        }
      }

      // 更新代理余额
      const { error: updateBalanceError } = await supabase
        .from('agent_profiles')
        .update({ 
          balance: supabase.sql`balance + ${commissionAmount}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId);

      if (updateBalanceError) {
        console.error('更新代理余额失败:', updateBalanceError);
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "订单处理成功",
        data: {
          orderId: order.id,
          customerEmail: customerEmail,
          productName: productInfo.name,
          orderAmount: orderAmount,
          commissionAmount: commissionAmount,
          agentId: agentId,
          hasReferral: !!agentId
        }
      }),
    };

  } catch (error) {
    console.error('处理订单函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
