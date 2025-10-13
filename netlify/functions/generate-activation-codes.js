const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 生成随机激活码
function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 20; i++) {
    if (i > 0 && i % 5 === 0) {
      code += '-';
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.handler = async (event) => {
  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const { quantity = 1, validDays = 365, notes = '' } = JSON.parse(event.body);

    // 验证参数
    if (quantity < 1 || quantity > 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: '数量必须在1-100之间' })
      };
    }

    if (validDays < 1 || validDays > 3650) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: '有效期必须在1-3650天之间' })
      };
    }

    // 生成激活码
    const codes = [];
    const now = new Date();
    const expiryDate = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

    for (let i = 0; i < quantity; i++) {
      const code = generateActivationCode();
      codes.push({
        code,
        status: 'active',
        created_at: now.toISOString(),
        expiry_date: expiryDate.toISOString(),
        notes,
        product_type: 'mediamingle_pro'
      });
    }

    // 保存到数据库
    const { data, error } = await supabase
      .from('activation_codes')
      .insert(codes)
      .select();

    if (error) {
      console.error('保存激活码失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: '保存激活码失败' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        codes: data,
        message: `成功生成 ${quantity} 个激活码`
      })
    };

  } catch (error) {
    console.error('生成激活码失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '生成激活码失败' })
    };
  }
};
