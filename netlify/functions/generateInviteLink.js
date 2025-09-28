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
    const { agentId, agentUserId, inviteType = 'user' } = JSON.parse(event.body || '{}');

    // 支持两种参数：agentId 或 agentUserId
    let targetAgentId = agentId;
    
    if (!targetAgentId && agentUserId) {
      // 如果传递的是 agentUserId，需要先查找对应的 agentId
      const { data: agentProfile, error: profileError } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', agentUserId)
        .single();
        
      if (profileError || !agentProfile) {
        return {
          statusCode: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ message: "代理信息不存在" }),
        };
      }
      
      targetAgentId = agentProfile.id;
    }

    if (!targetAgentId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "代理ID不能为空" }),
      };
    }

    // 1. 验证代理是否存在
    const { data: agent, error: agentError } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('id', targetAgentId)
      .single();

    if (agentError || !agent) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "代理不存在" }),
      };
    }

    // 2. 生成邀请码
    const inviteCode = `${agent.agent_code}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // 3. 设置过期时间（7天）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 4. 创建邀请记录
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert([{
        inviter_agent_id: targetAgentId,
        invitee_email: '', // 通用邀请链接，不指定具体邮箱
        invite_code: inviteCode,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      }])
      .select()
      .single();

    if (inviteError) {
      console.error('创建邀请记录失败:', inviteError);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "生成邀请链接失败" }),
      };
    }

    // 5. 生成邀请链接
    const baseUrl = process.env.NETLIFY_URL || 'http://localhost:8888';
    const inviteLink = `${baseUrl}/register.html?invite=${inviteCode}`;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "邀请链接生成成功",
        data: {
          inviteCode: inviteCode,
          inviteLink: inviteLink,
          expiresAt: expiresAt.toISOString(),
          agentCode: agent.agent_code
        }
      }),
    };

  } catch (error) {
    console.error('生成邀请链接函数出错:', error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "服务器内部错误", error: error.message }),
    };
  }
};
