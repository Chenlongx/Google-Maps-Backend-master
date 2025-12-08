// netlify/functions/verify_whatsapp.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        persistSession: false
    }
});

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { key, machine_id } = JSON.parse(event.body);

        if (!key || !machine_id) {
            return { statusCode: 400, body: JSON.stringify({ status: 'invalid', message: '激活码和机器码不能为空。' }) };
        }

        // 查询数据库中是否存在一个激活码和机器码都匹配，并且状态为'active'的记录
        const { data, error } = await supabase
            .from('whatsapp_activation_code')
            .select('*')
            .eq('key', key)
            .eq('machine_id', machine_id)
            .eq('status', 'active')
            .limit(1)
            .single();

        if (error || !data) {
            return { statusCode: 200, body: JSON.stringify({ status: 'invalid', message: '激活码无效或与本机不匹配。' }) };
        }

        // 检查是否已过期
        if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
            return { statusCode: 200, body: JSON.stringify({ status: 'expired', message: '激活码已过期，请续费。' }) };
        }

        // 计算剩余天数
        const daysLeft = data.expiry_date
            ? Math.ceil((new Date(data.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
            : -1;

        // 根据 notes 字段判断许可证类型
        const licenseType = data.notes?.includes('试用') ? 'trial'
            : (data.notes?.includes('高级') ? 'premium' : 'standard');

        return {
            statusCode: 200, body: JSON.stringify({
                status: 'valid',
                license_type: licenseType,
                days_left: daysLeft,
                expiry_date: data.expiry_date
            })
        };

    } catch (err) {
        console.error('验证函数出错:', err);
        return { statusCode: 500, body: JSON.stringify({ message: `服务器内部错误: ${err.message}` }) };
    }
};