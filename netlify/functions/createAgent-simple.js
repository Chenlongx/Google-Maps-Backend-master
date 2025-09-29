// 创建代理用户 - 简化版本
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
    
    const requestBody = event.body || '{}';
    const {
      email,
      password,
      realName,
      phone,
      alipayAccount,
      parentAgentCode,
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

    // 检查环境变量
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Supabase环境变量未配置');
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          message: '服务器配置错误：Supabase环境变量未配置'
        })
      };
    }

    // 动态导入Supabase客户端
    let supabase;
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      console.log('Supabase客户端创建成功');
    } catch (importError) {
      console.error('Supabase客户端导入失败:', importError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          message: '服务器配置错误：无法加载Supabase客户端'
        })
      };
    }

    // 生成代理邀请码
    function generateAgentCode() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
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

    console.log('用户创建成功，用户ID:', user.user.id);

    // 2. 查找上级代理
    console.log('查找上级代理...');
    let parentAgentId = null;
    if (parentAgentCode) {
      const { data: parentAgent } = await supabase
        .from('agent_profiles')
        .select('id, level')
        .eq('agent_code', parentAgentCode)
        .single();
      
      if (parentAgent) {
        parentAgentId = parentAgent.id;
        console.log('找到上级代理ID:', parentAgentId, '层级:', parentAgent.level);
      } else {
        console.log('未找到上级代理，使用空值');
      }
    }

    // 3. 计算代理层级
    const agentLevel = parentAgentId ? 2 : 1; // 简化版本：有上级代理就是2级，没有就是1级
    console.log('代理层级:', agentLevel);

    // 4. 生成代理邀请码
    console.log('生成代理邀请码...');
    let agentCode;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      agentCode = generateAgentCode();
      const { data: existing } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('agent_code', agentCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      console.error('无法生成唯一的代理邀请码');
      await supabase.auth.admin.deleteUser(user.user.id);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '无法生成唯一的代理邀请码' 
        }),
      };
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

    console.log('代理档案创建成功，代理ID:', agentProfile.id);

    // 6. 创建用户角色（可选，如果表存在的话）
    try {
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
    } catch (roleError) {
      console.log('用户角色表可能不存在，跳过角色创建');
    }

    // 7. 建立层级关系（可选，如果表存在的话）
    if (parentAgentId) {
      try {
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
      } catch (hierarchyError) {
        console.log('层级关系表可能不存在，跳过层级关系创建');
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
