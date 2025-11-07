const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// 对于纯粹的登录验证，使用 anon key 是安全的
const supabaseKey = process.env.SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ⭐ 管理员邮箱白名单
const ALLOWED_ADMIN_EMAILS = [
  '2231401652@qq.com',
  '1491367041@qq.com'
];

exports.handler = async function (event, context) {
  // CORS 预检请求处理 (保持不变)
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
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "邮箱和密码不能为空" }),
      };
    }

    // ⭐ 检查邮箱是否在白名单中
    if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "该邮箱没有管理员权限" }),
      };
    }

    // 直接使用 email 和 password 进行登录验证
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    // 如果有错误或没有返回 user 对象，则登录失败
    if (error || !data.user) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "登录失败，邮箱或密码错误" }),
      };
    }

    // 登录成功，直接返回成功信息和 token
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "登录成功",
        // 返回最核心的信息
        token: data.session.access_token,
        user: {
            id: data.user.id,
            email: data.user.email
        }
      }),
    };

  } catch (error) {
    console.error('登录函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};