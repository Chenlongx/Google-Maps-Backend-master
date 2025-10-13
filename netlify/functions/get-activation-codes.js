const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  console.log('=== get-activation-codes API 开始 ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Headers:', event.headers);
  
  // 只允许 GET 请求
  if (event.httpMethod !== 'GET') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    console.log('开始查询数据库...');
    // 获取所有激活码
    const { data, error } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('product_type', 'mediamingle_pro')
      .order('created_at', { ascending: false });

    console.log('数据库查询结果:');
    console.log('Data:', data);
    console.log('Error:', error);
    console.log('Data length:', data ? data.length : 0);

    if (error) {
      console.error('获取激活码失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: '获取激活码失败', error: error.message })
      };
    }

    // 更新过期状态并统一字段名
    const now = new Date();
    const updatedCodes = data.map(code => {
      if (code.status === 'active' && new Date(code.expiry_date) < now) {
        code.status = 'expired';
      }
      // 统一字段名，将 expiry_date 映射为 expires_at
      return {
        id: code.id,
        code: code.code,
        status: code.status,
        created_at: code.created_at,
        expires_at: code.expiry_date, // 映射字段名
        used_at: code.used_at,
        user_name: code.user_name, // 用户名
        user_email: code.user_email, // 用户邮箱
        used_by: code.user_email, // 保持向后兼容
        notes: code.notes
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        codes: updatedCodes
      })
    };

  } catch (error) {
    console.error('获取激活码失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '获取激活码失败' })
    };
  }
};
