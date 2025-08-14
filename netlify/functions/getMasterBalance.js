// 文件路径: netlify/functions/getMasterBalance.js

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    // 这里可以添加管理员权限验证
    // ...

    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'master_ai_token_balance')
            .single();

        if (error || !data) {
            // 如果没有找到设置，返回一个默认值0
            return { statusCode: 200, body: JSON.stringify({ success: true, balance: 0 }) };
        }
        
        // ================= 【关键修改】 =================
        // 1. 先将从数据库取出的字符串中的逗号全部移除
        const cleanedValue = data.setting_value.replace(/,/g, '');

        // 2. 再对清理后的纯数字字符串进行转换
        const balance = parseInt(cleanedValue, 10);
        // ================= 【修改结束】 =================

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, balance: balance }) // 使用处理后的 balance 变量
        };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: '服务器错误' }) };
    }
};