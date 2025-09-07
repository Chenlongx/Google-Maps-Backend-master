// // 这个函数负责接收前端发来的邮箱地址，并请求Supabase向该邮箱发送一个验证码。

// // netlify/functions/send-signup-otp.js
// const { createClient } = require('@supabase/supabase-js');

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
// const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// exports.handler = async (event) => {
//     if (event.httpMethod !== 'POST') {
//         return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
//     }

//     try {
//         const { email } = JSON.parse(event.body);

//         if (!email) {
//             return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Email is required' }) };
//         }

//         // 1. 检查账号是否已在您的 `user_accounts` 表中存在
//         const { data: existingUser, error: checkError } = await supabase
//             .from('user_accounts')
//             .select('id')
//             .eq('account', email)
//             .maybeSingle();

//         if (checkError) {
//             console.error('Error checking user existence:', checkError);
//             return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Database query failed' }) };
//         }

//         if (existingUser) {
//             return { statusCode: 409, body: JSON.stringify({ success: false, message: '此邮箱已被注册' }) };
//         }

//         // 2. 使用 Supabase Auth 发送 OTP 验证码
//         // shouldCreateUser: false 表示如果用户不存在于 auth.users 中，暂时不创建，等验证成功后再说。
//         const { error: otpError } = await supabase.auth.signInWithOtp({
//             email: email,
//             options: {
//                 // --- 修改这里 ---
//                 shouldCreateUser: true,
//             },
//         });

//         if (otpError) {
//             console.error('Supabase OTP error:', otpError);
//             return { statusCode: 500, body: JSON.stringify({ success: false, message: '验证码发送失败', error: otpError.message }) };
//         }

//         return {
//             statusCode: 200,
//             body: JSON.stringify({ success: true, message: '验证码已发送，请检查您的邮箱。' })
//         };

//     } catch (err) {
//         console.error('Handler error:', err);
//         return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器内部错误' }) };
//     }
// };




// netlify/functions/verify-and-register.js
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs'); // 引入加密库

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
    }

    try {
        // --- 核心修改 1: 从前端接收更多字段 ---
        const { email, password, token, device_id, os_type } = JSON.parse(event.body);

        if (!email || !password || !token || !device_id || !os_type) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '所有字段都不能为空' }) };
        }
        
        // --- 核心修改 2: 检查设备ID是否已被使用 ---
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
        // --- 设备ID检查结束 ---

        // 3. 验证邮箱和验证码 (OTP)
        const { data: { user }, error: verifyError } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'signup',
        });

        if (verifyError || !user) {
            console.error('Supabase OTP verification error:', verifyError);
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '验证码错误或已过期' }) };
        }

        // --- 核心修改 3: 密码加密 ---
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        // --- 密码加密结束 ---

        // --- 核心修改 4: 设置账户类型、有效期和其他试用属性 ---
        const now = new Date();
        const expiryDate = new Date(now.setFullYear(now.getFullYear() + 1)); // 当前时间加一年

        const newUserRecord = {
            account: email,
            password: hashedPassword, // 存储加密后的密码
            device_id: device_id,
            os_type: os_type,
            user_type: 'trial',         // 设置用户类型为 trial
            status: 'active',
            expiry_at: expiryDate.toISOString(), // 设置一年后的到期时间
            is_ai_authorized: false,     // 试用期默认授权AI
            ai_tokens_remaining: 0,    // 赠送50个AI Tokens
            daily_export_count: 0
        };
        // --- 设置结束 ---

        // 5. 将完整的用户信息插入到 `user_accounts` 表中
        const { error: insertError } = await supabase
            .from('user_accounts')
            .insert([newUserRecord]);

        if (insertError) {
            console.error('Error inserting new user:', insertError);
            if (insertError.code === '23505') { // PostgreSQL a unique violation error code
                 return { statusCode: 409, body: JSON.stringify({ success: false, message: '此邮箱已被注册' }) };
            }
            return { statusCode: 500, body: JSON.stringify({ success: false, message: '创建用户失败' }) };
        }

        return {
            statusCode: 201,
            body: JSON.stringify({ success: true, message: '试用账号注册成功！有效期一年。' })
        };

    } catch (err) {
        console.error('Handler error:', err);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器内部错误' }) };
    }
};