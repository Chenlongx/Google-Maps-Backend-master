// 文件路径: netlify/functions/updateMasterBalance.js

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    // 这里必须有严格的管理员权限验证
    // ...

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { newBalance } = JSON.parse(event.body);
        const balance = parseInt(newBalance, 10);

        if (isNaN(balance) || balance < 0) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '无效的Token数量' }) };
        }

        const { error } = await supabase
            .from('app_settings')
            .update({ setting_value: balance.toString() })
            .eq('setting_key', 'master_ai_token_balance');

        if (error) throw error;

        return { statusCode: 200, body: JSON.stringify({ success: true, message: '总Token数更新成功' }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器错误' }) };
    }
};