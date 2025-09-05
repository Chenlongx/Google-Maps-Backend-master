// // functions/getLicenses.js
// const { createClient } = require('@supabase/supabase-js');

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// exports.handler = async function(event, context) {
//     // 简单的身份验证检查，实际生产环境建议使用更健壮的JWT验证
//     // 这里我们假设前端会传来一个 password 作为简单的凭证
//     const { password } = event.queryStringParameters;
//     if (password !== process.env.ADMIN_PASSWORD) { // ADMIN_PASSWORD 也应在Netlify环境变量中设置
//         return { statusCode: 401, body: JSON.stringify({ success: false, message: '未授权' }) };
//     }

//     try {
//         const { data, error } = await supabase
//             .from('licenses')
//             .select('*')
//             .order('created_at', { ascending: false }); // 按创建时间降序排序

//         if (error) {
//             throw error;
//         }

//         return {
//             statusCode: 200,
//             body: JSON.stringify({ success: true, licenses: data })
//         };

//     } catch (err) {
//         console.error('获取激活码列表失败:', err);
//         return {
//             statusCode: 500,
//             body: JSON.stringify({ success: false, message: '服务器内部错误。' })
//         };
//     }
// };


// functions/getLicenses.js (新的，采用JWT验证)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async function(event, context) {
    // 1. 从请求头获取并验证 Token (与 getUsers.js 逻辑相同)
    const authorizationHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authorizationHeader) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未提供Token，请登录' }) };
    }
    const token = authorizationHeader.split(' ')[1];
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 格式错误' }) };
    }

    // 2. 验证Token是否有效
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 无效或已过期' }) };
    }
    
    // (可选，但推荐) 3. 检查该用户是否是管理员
    // 假设你的用户表或 Supabase Auth 的 metadata 中有 'role' 字段
    // if (user.user_metadata.role !== 'admin') {
    //     return { statusCode: 403, body: JSON.stringify({ success: false, message: '权限不足' }) };
    // }

    // 4. Token 验证通过，执行原有的业务逻辑
    try {
        const { data, error } = await supabase
            .from('licenses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, licenses: data })
        };
    } catch (err) {
        console.error('获取激活码列表失败:', err);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器内部错误。' }) };
    }
};