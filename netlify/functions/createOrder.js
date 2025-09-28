// 创建订单
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

// 如果没有配置 Supabase，返回配置错误
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  exports.handler = async (event, context) => {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: false,
        message: '请先配置 Supabase 环境变量：SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY'
      })
    };
  };
  return;
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
      outTradeNo,
      productId,
      customerEmail,
      status = 'pending'
    } = JSON.parse(event.body || '{}');

    if (!outTradeNo || !productId || !customerEmail) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '外部交易号、产品ID和客户邮箱不能为空' 
        }),
      };
    }

    // 检查外部交易号是否已存在
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('out_trade_no', outTradeNo)
      .single();

    if (existingOrder) {
      return {
        statusCode: 409,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '该外部交易号已存在' 
        }),
      };
    }

    // 创建订单
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        out_trade_no: outTradeNo,
        product_id: productId,
        customer_email: customerEmail,
        status: status
      }])
      .select()
      .single();

    if (orderError) {
      console.error('创建订单失败:', orderError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '创建订单失败: ' + orderError.message 
        }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: '订单创建成功',
        data: {
          orderId: order.id,
          outTradeNo: order.out_trade_no,
          status: order.status
        }
      }),
    };

  } catch (error) {
    console.error('创建订单函数出错:', error);
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
