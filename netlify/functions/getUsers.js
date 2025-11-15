const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  try {
    const authorizationHeader = event.headers['authorization'] || event.headers['Authorization'];
    // console.log('接收到的 Authorization 头:', authorizationHeader);

    if (!authorizationHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Token 不存在，请登录' }),
      };
    }

    const token = authorizationHeader.split(' ')[1];
    // console.log('提取到的 Token:', token);

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Token 格式错误' }),
      };
    }

    supabase.auth.setSession({
      access_token: token,
      refresh_token: 'dummy_refresh_token',
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.error('Supabase Token 验证失败:', userError);
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Token 无效或已过期', error: userError?.message }),
      };
    }

    console.log('当前登录用户:', userData.user.id);

    // 接下来查询 user_accounts 表
    const { data: users, error: usersError } = await supabase
      .from('user_accounts')
      .select('*');

    if (usersError) {
      console.error('查询 user_accounts 失败:', usersError);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: '查询用户数据失败', error: usersError.message }),
      };
    }

    // *** 添加这行来输出获取到的表单信息 ***
    // console.log('从 user_accounts 表获取到的用户数据:', users); 

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '用户数据查询成功',
        users: users,
      }),
    };
  } catch (error) {
    console.error('处理请求时出错:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '服务器错误', error: error.message }),
    };
  }
};