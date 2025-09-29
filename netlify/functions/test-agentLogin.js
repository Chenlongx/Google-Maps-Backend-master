const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
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

  try {
    console.log('=== 测试代理登录函数 ===');
    console.log('HTTP方法:', event.httpMethod);
    console.log('请求体:', event.body);
    console.log('请求头:', JSON.stringify(event.headers, null, 2));
    console.log('查询参数:', event.queryStringParameters);
    
    // 测试不同的请求体解析方式
    let requestData = {};
    
    if (event.body) {
      try {
        requestData = JSON.parse(event.body);
        console.log('JSON解析成功:', requestData);
      } catch (parseError) {
        console.error('JSON解析失败:', parseError);
        return {
          statusCode: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ 
            message: "JSON解析失败", 
            error: parseError.message,
            receivedBody: event.body
          }),
        };
      }
    }
    
    const { email, password } = requestData;
    console.log('提取的邮箱:', email);
    console.log('提取的密码:', password ? '***' : 'undefined');
    
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          message: "邮箱和密码不能为空",
          receivedData: { email, password: password ? '***' : 'undefined' }
        }),
      };
    }
    
    // 测试Supabase连接
    console.log('测试Supabase连接...');
    const { data: testData, error: testError } = await supabase
      .from('agent_profiles')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('Supabase连接测试失败:', testError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          message: "数据库连接失败", 
          error: testError.message 
        }),
      };
    }
    
    console.log('Supabase连接测试成功');
    
    // 尝试登录
    console.log('尝试Supabase认证...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    
    if (error || !data.user) {
      console.log('Supabase认证失败:', error);
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          message: "登录失败，邮箱或密码错误",
          error: error?.message 
        }),
      };
    }
    
    console.log('Supabase认证成功，用户ID:', data.user.id);
    
    // 检查代理状态
    const { data: agentProfile, error: agentError } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();
    
    if (agentError || !agentProfile) {
      console.log('代理资料查询失败:', agentError);
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          message: "该账号不是代理账号，请使用管理员登录",
          error: agentError?.message 
        }),
      };
    }
    
    console.log('代理资料查询成功:', agentProfile.agent_code);
    
    // 返回成功响应
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "测试登录成功",
        token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          userType: 'agent'
        },
        agent: {
          id: agentProfile.id,
          agentCode: agentProfile.agent_code,
          level: agentProfile.level,
          commissionRate: agentProfile.commission_rate,
          totalCommission: agentProfile.total_commission,
          availableBalance: agentProfile.available_balance
        }
      }),
    };
    
  } catch (error) {
    console.error('测试函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        message: "服务器内部错误", 
        error: error.message,
        stack: error.stack 
      }),
    };
  }
};
