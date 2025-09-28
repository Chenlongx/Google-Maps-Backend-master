// 删除产品推广链接
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
        "Access-Control-Allow-Methods": "DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: '',
    };
  }

  try {
    // 验证请求方法
    if (event.httpMethod !== 'DELETE') {
      return {
        statusCode: 405,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "只支持DELETE方法" }),
      };
    }

    // 解析请求体
    const { promotionId } = JSON.parse(event.body || '{}');

    if (!promotionId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "推广ID不能为空" }),
      };
    }

    // 验证推广记录是否存在
    const { data: promotion, error: fetchError } = await supabase
      .from('product_promotions')
      .select('*')
      .eq('id', promotionId)
      .single();

    if (fetchError || !promotion) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "推广记录不存在" }),
      };
    }

    // 删除推广记录
    const { error: deleteError } = await supabase
      .from('product_promotions')
      .delete()
      .eq('id', promotionId);

    if (deleteError) {
      console.error('删除推广记录失败:', deleteError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "删除推广记录失败" }),
      };
    }

    // 同时删除相关的点击记录（可选）
    await supabase
      .from('promotion_clicks')
      .delete()
      .eq('promotion_code', promotion.promotion_code);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "推广链接删除成功",
        data: {
          promotionId: promotionId,
          deletedAt: new Date().toISOString()
        }
      }),
    };

  } catch (error) {
    console.error('删除产品推广链接函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
