// 追踪推广点击
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
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  try {
    console.log('收到推广点击追踪请求:', event.body);
    
    const { 
      promotionCode, 
      agentCode, 
      productType, 
      pageUrl, 
      userAgent, 
      referrer, 
      timestamp 
    } = JSON.parse(event.body || '{}');

    console.log('解析的请求数据:', {
      promotionCode,
      agentCode,
      productType,
      pageUrl,
      userAgent: userAgent ? '***' : 'undefined',
      referrer,
      timestamp
    });

    if (!promotionCode || !agentCode) {
      console.log('推广码或代理代码为空');
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "推广码和代理代码不能为空" }),
      };
    }

    // 1. 查找对应的推广记录
    console.log('查找推广记录:', promotionCode);
    const { data: promotion, error: promotionError } = await supabase
      .from('product_promotions')
      .select('*')
      .eq('promotion_code', promotionCode)
      .single();

    if (promotionError || !promotion) {
      console.error('推广记录不存在:', promotionError);
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "推广记录不存在" }),
      };
    }

    console.log('找到推广记录:', promotion);

    // 2. 记录点击
    console.log('记录点击到promotion_clicks表');
    const { data: click, error: clickError } = await supabase
      .from('promotion_clicks')
      .insert([{
        promotion_code: promotionCode,
        agent_id: promotion.agent_id,
        ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown',
        user_agent: userAgent,
        referrer: referrer,
        clicked_at: new Date(timestamp).toISOString()
      }])
      .select()
      .single();

    if (clickError) {
      console.error('记录点击失败:', clickError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "记录点击失败" }),
      };
    }

    console.log('点击记录成功:', click);

    // 3. 更新推广记录的点击次数
    console.log('更新推广记录点击次数');
    const { error: updateError } = await supabase
      .from('product_promotions')
      .update({ 
        clicks_count: promotion.clicks_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', promotion.id);

    if (updateError) {
      console.error('更新点击次数失败:', updateError);
    } else {
      console.log('点击次数更新成功');
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "点击记录成功",
        data: {
          clickId: click.id,
          promotionCode: promotionCode,
          agentCode: agentCode,
          productType: productType
        }
      }),
    };

  } catch (error) {
    console.error('追踪推广点击函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
