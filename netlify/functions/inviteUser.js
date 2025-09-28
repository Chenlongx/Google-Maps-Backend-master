// 代理邀请用户
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 生成邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
    const {
      inviterUserId,
      inviteeEmail,
      inviteType = 'customer' // 'customer' 或 'agent'
    } = JSON.parse(event.body || '{}');

    if (!inviterUserId || !inviteeEmail) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '邀请人ID和被邀请人邮箱不能为空' 
        }),
      };
    }

    // 1. 验证邀请人是否为代理
    const { data: inviterAgent, error: agentError } = await supabase
      .from('agent_profiles')
      .select('id, agent_code, real_name')
      .eq('user_id', inviterUserId)
      .single();

    if (agentError || !inviterAgent) {
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '只有代理才能邀请用户' 
        }),
      };
    }

    // 2. 检查邮箱是否已被邀请
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id, status')
      .eq('invitee_email', inviteeEmail)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return {
        statusCode: 409,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          success: false, 
          message: '该邮箱已有待处理的邀请' 
        }),
      };
    }

    // 3. 生成邀请码
    let inviteCode;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const { data: existing } = await supabase
        .from('invitations')
        .select('id')
        .eq('invite_code', inviteCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      }
    }

    // 4. 设置过期时间（7天）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. 创建邀请记录
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert([{
        inviter_agent_id: inviterAgent.id,
        invitee_email: inviteeEmail,
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
        body: JSON.stringify({ 
          success: false, 
          message: '创建邀请失败: ' + inviteError.message 
        }),
      };
    }

    // 6. 发送邀请邮件（这里可以集成邮件服务）
    // TODO: 集成邮件服务发送邀请链接
    const inviteLink = `${process.env.FRONTEND_URL}/register?invite=${inviteCode}&type=${inviteType}`;

    return {
      statusCode: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: '邀请发送成功',
        data: {
          invitationId: invitation.id,
          inviteCode: inviteCode,
          inviteLink: inviteLink,
          expiresAt: expiresAt.toISOString()
        }
      }),
    };

  } catch (error) {
    console.error('邀请用户函数出错:', error);
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
