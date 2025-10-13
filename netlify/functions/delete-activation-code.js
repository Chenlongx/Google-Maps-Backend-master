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
    const { id } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: '缺少激活码ID' })
      };
    }

    // 删除激活码
    const { error } = await supabase
      .from('activation_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除激活码失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: '删除激活码失败' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: '删除成功'
      })
    };

  } catch (error) {
    console.error('删除激活码失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '删除激活码失败' })
    };
  }
};
