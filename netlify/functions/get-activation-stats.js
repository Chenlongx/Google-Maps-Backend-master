const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // 只允许 GET 请求
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    // 获取所有激活码
    const { data, error } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('product_type', 'mediamingle_pro');

    if (error) {
      console.error('获取激活码统计失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: '获取统计失败' })
      };
    }

    // 计算统计信息
    const now = new Date();
    const stats = {
      total: data.length,
      active: 0,
      expired: 0,
      used: 0
    };

    data.forEach(code => {
      if (code.status === 'used') {
        stats.used++;
      } else if (new Date(code.expiry_date) < now) {
        stats.expired++;
      } else if (code.status === 'active') {
        stats.active++;
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        stats
      })
    };

  } catch (error) {
    console.error('获取激活码统计失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '获取统计失败' })
    };
  }
};
