// netlify/functions/verify_whatsapp.js

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
            .select('id')
            .eq('key', key)
            .eq('machine_id', machine_id)
            .eq('status', 'active')
            .limit(1)
            .single(); // .single() 期望找到一条或零条记录

        if (error || !data) {
            // 如果出错或找不到记录，则验证失败
            return { statusCode: 200, body: JSON.stringify({ status: 'invalid', message: '激活码无效或与本机不匹配。' }) };
        }

        // 如果找到了匹配的记录，验证成功
        return { statusCode: 200, body: JSON.stringify({ status: 'valid' }) };

    } catch (err) {
        console.error('验证函数出错:', err);
        return { statusCode: 500, body: JSON.stringify({ message: `服务器内部错误: ${err.message}` }) };
    }
};