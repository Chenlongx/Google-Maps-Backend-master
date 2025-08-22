// 这个函数接收前端发来的邮箱、密码和验证码，验证通过后，在您的user_accounts表中创建新用户

// netlify/functions/verify-and-register.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
  }

  try {
    const { email, password, token } = JSON.parse(event.body);

    if (!email || !password || !token) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: '邮箱、密码和验证码不能为空' }) };
    }

    // 1. 验证 OTP
    const { data: { session }, error: verifyError } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email', // 确保类型是 email OTP
    });

    if (verifyError) {
      console.error('Supabase verification error:', verifyError);
      return { statusCode: 401, body: JSON.stringify({ success: false, message: '验证码错误或已过期', error: verifyError.message }) };
    }
    
    if (!session) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '验证失败，无法获取会话' }) };
    }

    // 验证成功！现在可以在 `user_accounts` 表中创建用户记录了

    // 2. 准备新用户数据 (默认试用)
    const expiryAt = new Date();
    expiryAt.setHours(expiryAt.getHours() + 12); // <-- 修改在这里：设置为12小时后过期

    const newUser = {
      account: email,
      password: password, // 警告：生产环境中强烈建议对密码进行哈希处理！
      user_type: 'trial', // 默认用户类型为 trial
      created_at: new Date().toISOString(),
      expiry_at: expiryAt.toISOString(),
      status: 'active',
      is_ai_authorized: false, // 默认AI权限为 false
      ai_tokens_remaining: 0, // 默认AI token为0
    };

    // 3. 插入数据到 `user_accounts` 表
    const { error: insertError } = await supabase
      .from('user_accounts')
      .insert(newUser);

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      // 如果错误是23505，表示唯一约束冲突（可能用户已存在）
      if (insertError.code === '23505') {
        return { statusCode: 409, body: JSON.stringify({ success: false, message: '此邮箱已被注册' }) };
      }
      return { statusCode: 500, body: JSON.stringify({ success: false, message: '创建用户档案失败', error: insertError.message }) };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ success: true, message: '注册成功！现在您可以登录了。' })
    };

  } catch (err) {
    console.error('Handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器内部错误' }) };
  }
};