// functions/getLicenses.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async function(event, context) {
    // 简单的身份验证检查，实际生产环境建议使用更健壮的JWT验证
    // 这里我们假设前端会传来一个 password 作为简单的凭证
    const { password } = event.queryStringParameters;
    if (password !== process.env.ADMIN_PASSWORD) { // ADMIN_PASSWORD 也应在Netlify环境变量中设置
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未授权' }) };
    }

    try {
        const { data, error } = await supabase
            .from('licenses')
            .select('*')
            .order('created_at', { ascending: false }); // 按创建时间降序排序

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, licenses: data })
        };

    } catch (err) {
        console.error('获取激活码列表失败:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: '服务器内部错误。' })
        };
    }
};