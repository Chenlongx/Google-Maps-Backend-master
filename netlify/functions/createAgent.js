// 创建代理用户
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

// 如果没有配置 Supabase，返回配置错误
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  exports.handler = async (event, context) => {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: false,
        message: '请先配置 Supabase 环境变量：SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY'
      })
    };
  };
  return;
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 生成代理邀请码
function generateAgentCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 计算代理层级
async function calculateAgentLevel(parentAgentId) {
  if (!parentAgentId) return 1;
  
  const { data: parentAgent } = await supabase
    .from('agent_profiles')
    .select('level')
    .eq('id', parentAgentId)
    .single();
    
  return parentAgent ? parentAgent.level + 1 : 1;
}

exports.handler = async (event, context) => {
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: '只支持 POST 请求' }),
    };
  }

  try {
    console.log('收到代理注册请求，请求体:', event.body);
    console.log('请求头:', event.headers);
    
    const requestBody = event.body || '{}';
    console.log('解析前的请求体:', requestBody);
    
    const {
      email,
      password,
      realName,
      phone,
      alipayAccount,
      parentAgentCode, // 上级代理邀请码
      commissionRate
    } = JSON.parse(requestBody);
    
    console.log('解析后的数据:', {
      email,
      password: password ? '***' : 'undefined',
      realName,
      phone,
      alipayAccount,
      parentAgentCode,
      commissionRate
    });

    if (!email || !password || !realName || !phone || !alipayAccount) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '邮箱、密码、真实姓名、手机号和支付宝账号不能为空' 
        }),
      };
    }

    // 1. 创建用户账号
    console.log('开始创建用户账号...');
    const { data: user, error: createUserError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (createUserError) {
      console.error('创建用户失败:', createUserError);
      
      // 处理邮箱已存在的错误
      if (createUserError.code === 'email_exists') {
        return {
          statusCode: 409,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ 
            success: false, 
            message: '该邮箱地址已被注册，请使用其他邮箱或直接登录' 
          }),
        };
      }
      
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '创建用户失败: ' + createUserError.message 
        }),
      };
    }

    // 2. 查找上级代理
    console.log('查找上级代理...');
    let parentAgentId = null;
    if (parentAgentCode) {
      const { data: parentAgent } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('agent_code', parentAgentCode)
        .single();
      
      if (parentAgent) {
        parentAgentId = parentAgent.id;
        console.log('找到上级代理ID:', parentAgentId);
      } else {
        console.log('未找到上级代理，使用空值');
      }
    }

    // 3. 计算代理层级
    console.log('计算代理层级...');
    const agentLevel = await calculateAgentLevel(parentAgentId);
    console.log('代理层级:', agentLevel);

    // 4. 生成代理邀请码
    console.log('生成代理邀请码...');
    let agentCode;
    let isUnique = false;
    while (!isUnique) {
      agentCode = generateAgentCode();
      const { data: existing } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('agent_code', agentCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      }
    }
    console.log('生成的代理邀请码:', agentCode);

    // 5. 创建代理档案
    console.log('创建代理档案...');
    const agentData = {
      user_id: user.user.id,
      agent_code: agentCode,
      parent_agent_id: parentAgentId,
      level: agentLevel,
      commission_rate: commissionRate || 10.00,
      real_name: realName,
      phone: phone,
      alipay_account: alipayAccount,
      status: 'active'
    };
    console.log('代理档案数据:', agentData);
    
    const { data: agentProfile, error: agentError } = await supabase
      .from('agent_profiles')
      .insert([agentData])
      .select()
      .single();

    if (agentError) {
      console.error('创建代理档案失败:', agentError);
      // 回滚：删除已创建的用户
      await supabase.auth.admin.deleteUser(user.user.id);
      
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '创建代理档案失败: ' + agentError.message 
        }),
      };
    }

    // 6. 创建用户角色
    console.log('创建用户角色...');
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([{
        user_id: user.user.id,
        role_name: 'agent',
        permissions: {
          invite_users: true,
          view_team: true,
          view_commission: true,
          apply_withdrawal: true
        }
      }]);

    if (roleError) {
      console.error('创建用户角色失败:', roleError);
    } else {
      console.log('用户角色创建成功');
    }

    // 7. 如果有上级代理，建立层级关系
    if (parentAgentId) {
      console.log('建立层级关系...');
      const { error: hierarchyError } = await supabase
        .from('agent_hierarchy')
        .insert([{
          agent_id: agentProfile.id,
          parent_agent_id: parentAgentId,
          level: 1
        }]);

      if (hierarchyError) {
        console.error('建立层级关系失败:', hierarchyError);
      } else {
        console.log('层级关系建立成功');
      }
    }

    console.log('代理创建成功，返回响应');
    return {
      statusCode: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: '代理创建成功',
        data: {
          userId: user.user.id,
          agentId: agentProfile.id,
          agentCode: agentCode,
          level: agentLevel
        }
      }),
    };

  } catch (error) {
    console.error('创建代理函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        success: false, 
        message: '服务器内部错误', 
        error: error.message 
      }),
    };
  }
};
