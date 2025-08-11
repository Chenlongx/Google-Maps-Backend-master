const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // 这里用匿名key即可做用户登录验证

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
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
    const { username, password } = JSON.parse(event.body || '{}');

    if (!username || !password) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "用户名和密码不能为空" }),
      };
    }

    // 这里调用 Supabase Auth 需要的是 email，不能直接用 username，除非你用户表里用 username 存了 email
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,  // 这里还是需要邮箱
      password,
    });


    if (error || !data.user) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "登录失败，邮箱或密码错误" }),
      };
    }

    // 登录成功，拿 user id 去 profiles 表查角色等扩展信息（可选）
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type, username')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      // 可以选择忽略或返回错误
      console.error('查询用户扩展信息失败:', profileError);
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "登录成功",
        user: {
          id: data.user.id,
          email: data.user.email,
          username: profile?.username || null,
          user_type: profile?.user_type || null,
        },
        access_token: data.session.access_token, // 这里是 Supabase 的 JWT
        refresh_token: data.session.refresh_token, // 这里是 Supabase 的刷新 Token
      }),
    };

  } catch (error) {
    console.error('登录出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器错误", error: error.message }),
    };
  }
};
