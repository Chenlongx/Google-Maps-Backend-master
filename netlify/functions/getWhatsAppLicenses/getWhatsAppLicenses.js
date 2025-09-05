// functions/getWhatsAppLicenses/getWhatsAppLicenses.js (已修正为Token验证)

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; 
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async function(event, context) {
    // --- 核心修改：从验证密码改为验证Token ---

    // 1. 从请求头中获取 Authorization
    const authorizationHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authorizationHeader) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未提供Token，请登录' }) };
    }

    // 2. 提取 Token
    const token = authorizationHeader.split(' ')[1];
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 格式不正确' }) };
    }

    // 3. 使用 Supabase 验证 Token 的有效性
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Token 无效或已过期' }) };
    }
    
    // --- 验证通过，执行后续的数据查询 ---
    
    try {
        const { data, error } = await supabase
            .from('whatsapp_activation_code')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('获取到的激活码数据:', data);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, licenses: data })
        };
    } catch (err) {
        console.error('获取WhatsApp激活码列表失败:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: '服务器内部错误。' })
        };
    }
};