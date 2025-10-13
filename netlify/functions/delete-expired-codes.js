const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // 允许 DELETE 请求
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const now = new Date().toISOString();

    // 删除所有过期的激活码
    const { data, error } = await supabase
      .from('activation_codes')
      .delete()
      .eq('product_type', 'mediamingle_pro')
      .lt('expiry_date', now)
      .select();

    if (error) {
      console.error('删除过期激活码失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: '删除过期激活码失败' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        deletedCount: data ? data.length : 0,
        message: `成功删除 ${data ? data.length : 0} 个过期激活码`
      })
    };

  } catch (error) {
    console.error('删除过期激活码失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '删除过期激活码失败' })
    };
  }
};
