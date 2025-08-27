// // 这个函数负责接收前端传来的一组激活码ID，并在数据库中安全地将它们删除。


// // functions/deleteLicense.js
// const { createClient } = require('@supabase/supabase-js');

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// exports.handler = async function(event, context) {
//     if (event.httpMethod !== 'POST') {
//         return { statusCode: 405, body: 'Method Not Allowed' };
//     }
    
//     // 身份验证
//     const { password, licenseIds } = JSON.parse(event.body);
//     if (password !== process.env.ADMIN_PASSWORD) {
//         return { statusCode: 401, body: JSON.stringify({ success: false, message: '未授权' }) };
//     }

//     if (!licenseIds || !Array.isArray(licenseIds) || licenseIds.length === 0) {
//         return { statusCode: 400, body: JSON.stringify({ success: false, message: '未提供有效的激活码ID列表。' }) };
//     }

//     try {
//         const { error } = await supabase
//             .from('licenses')
//             .delete()
//             .in('id', licenseIds); // 使用 in 过滤器批量删除

//         if (error) {
//             throw error;
//         }

//         return {
//             statusCode: 200,
//             body: JSON.stringify({ success: true, message: '激活码删除成功！' })
//         };

//     } catch (err) {
//         console.error('删除激活码失败:', err);
//         return {
//             statusCode: 500,
//             body: JSON.stringify({ success: false, message: `删除失败: ${err.message}` })
//         };
//     }
// };


// functions/deleteLicense.js (已修正，使用 service_role 密钥)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// --- 修改点：使用 SUPABASE_SERVICE_ROLE_KEY ---
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- 修改点：在创建客户端时传入 service_role 密钥 ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    // 身份验证
    const { password, licenseIds } = JSON.parse(event.body);
    if (password !== process.env.ADMIN_PASSWORD) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未授权' }) };
    }

    if (!licenseIds || !Array.isArray(licenseIds) || licenseIds.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: '未提供有效的激活码ID列表。' }) };
    }

    try {
        const { error } = await supabase
            .from('licenses')
            .delete()
            .in('id', licenseIds); // 使用 in 过滤器批量删除

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: '激活码删除成功！' })
        };

    } catch (err) {
        console.error('删除激活码失败:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: `删除失败: ${err.message}` })
        };
    }
};