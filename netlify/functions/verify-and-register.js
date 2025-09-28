// netlify/functions/verify-and-register.js
const { createClient } = require('@supabase/supabase-js');
// const bcrypt = require('bcryptjs'); // 步骤1：移除或注释掉加密库的引用

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
    }

    try {
        const { email, password, token, device_id, os_type, invite_code } = JSON.parse(event.body);

        if (!email || !password || !token || !device_id || !os_type) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '所有字段都不能为空' }) };
        }
        
        const { data: existingDevice, error: deviceCheckError } = await supabase
            .from('user_accounts')
            .select('id')
            .eq('device_id', device_id)
            .maybeSingle();

        if (deviceCheckError) {
            console.error('Error checking device ID:', deviceCheckError);
            return { statusCode: 500, body: JSON.stringify({ success: false, message: '数据库查询失败' }) };
        }

        if (existingDevice) {
            return { statusCode: 409, body: JSON.stringify({ success: false, message: '此设备已注册过试用账号' }) };
        }

        const { data: { user }, error: verifyError } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email', 
        });

        if (verifyError || !user) {
            console.error('Supabase OTP verification error:', verifyError);
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '验证码错误或已过期' }) };
        }

        // --- 核心修改 2: 移除密码加密过程 ---
        // const saltRounds = 10;
        // const hashedPassword = await bcrypt.hash(password, saltRounds);
        // --- 密码加密过程已被移除 ---

        const now = new Date();
        const expiryDate = new Date(now.setDate(now.getDate() + 1)); 

        const newUserRecord = {
            account: email,
            // --- 核心修改 3: 直接存储原始密码 ---
            // 注意：您的数据库字段应为 password 或 password_hash，请确保此处匹配
            password: password, // 直接使用从前端传来的原始密码
            device_id: device_id,
            os_type: os_type,
            user_type: 'standard',
            status: 'active',
            expiry_at: expiryDate.toISOString(),
            is_ai_authorized: false,
            ai_tokens_remaining: 0,
            daily_export_count: 0
        };

        const { error: insertError } = await supabase
            .from('user_accounts')
            .insert([newUserRecord]);

        if (insertError) {
            console.error('Error inserting new user:', insertError);
            if (insertError.code === '23505') {
                 return { statusCode: 409, body: JSON.stringify({ success: false, message: '此邮箱已被注册' }) };
            }
            return { statusCode: 500, body: JSON.stringify({ success: false, message: '创建用户失败' }) };
        }

        // 处理代理邀请码关联
        if (invite_code) {
            try {
                // 1. 验证邀请码
                const { data: invitation, error: inviteError } = await supabase
                    .from('invitations')
                    .select('*, agent_profiles!inner(*)')
                    .eq('invite_code', invite_code)
                    .eq('status', 'pending')
                    .single();

                if (!inviteError && invitation) {
                    // 检查邀请码是否过期
                    const now = new Date();
                    const expiresAt = new Date(invitation.expires_at);
                    
                    if (now < expiresAt) {
                        // 2. 创建用户-代理关联记录
                        await supabase
                            .from('user_agent_relations')
                            .insert([{
                                user_id: user.id,
                                agent_id: invitation.agent_profiles.id,
                                invite_code: invite_code,
                                registration_source: 'agent_invite'
                            }]);

                        // 3. 更新邀请记录状态
                        await supabase
                            .from('invitations')
                            .update({ 
                                status: 'accepted',
                                accepted_at: new Date().toISOString(),
                                invitee_email: email
                            })
                            .eq('id', invitation.id);

                        console.log(`用户 ${email} 通过代理 ${invitation.agent_profiles.agent_code} 注册成功`);
                    }
                }
            } catch (relationError) {
                console.error('处理代理关联失败:', relationError);
                // 不影响用户注册，只记录错误
            }
        }

        return {
            statusCode: 201,
            body: JSON.stringify({ success: true, message: '试用账号注册成功！有效期一天，请及时转为正式账号。' })
        };

    } catch (err) {
        console.error('Handler error:', err);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器内部错误' }) };
    }
};