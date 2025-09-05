// functions/deleteWhatsAppLicense.js (已修正为Token验证)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    // --- 核心修改：从验证密码改为验证Token ---

    // 1. 从请求头中获取并验证 Token
    const authorizationHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authorizationHeader) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未提供Token，请登录' }) };
    }
    const token = authorizationHeader.split(' ')[1];
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 格式不正确' }) };
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 无效或已过期' }) };
    }

    // --- Token验证通过 ---
    
    // 2. 从请求体中只获取 licenseIds，不再需要 password
    const { licenseIds } = JSON.parse(event.body);

    if (!licenseIds || !Array.isArray(licenseIds) || licenseIds.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: '未提供有效的激活码ID列表。' }) };
    }

    try {
        // --- 后续的数据库操作逻辑保持不变 ---
        const { error } = await supabase
            .from('whatsapp_activation_code')
            .delete()
            .in('id', licenseIds);

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: '激活码删除成功！' })
        };

    } catch (err) {
        console.error('删除WhatsApp激活码失败:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: `删除失败: ${err.message}` })
        };
    }
};