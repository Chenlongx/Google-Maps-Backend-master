// netlify/functions/activation_program_whatsapp.js

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
            return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: '激活码和机器码不能为空。' }) };
        }

        // 1. 查找激活码是否存在
        const { data: license, error: fetchError } = await supabase
            .from('whatsapp_activation_code')
            .select('*')
            .eq('key', key)
            .limit(1)
            .single();

        if (fetchError || !license) {
            return { statusCode: 200, body: JSON.stringify({ status: 'failed', message: '激活码不存在。' }) };
        }

        // 2. 检查激活码的状态
        if (license.status === 'active') {
            // 如果已经激活，检查机器码是否匹配
            if (license.machine_id === machine_id) {
                return { statusCode: 200, body: JSON.stringify({ status: 'valid', message: '此激活码已在本机激活。' }) };
            } else {
                return { statusCode: 200, body: JSON.stringify({ status: 'failed', message: '此激活码已被其他机器使用。' }) };
            }
        }

        if (license.status !== 'available') {
            return { statusCode: 200, body: JSON.stringify({ status: 'failed', message: `激活码状态异常 (${license.status})，请联系管理员。` }) };
        }

        // 3. 激活码可用，执行绑定操作
        const { error: updateError } = await supabase
            .from('whatsapp_activation_code')
            .update({
                status: 'active',
                machine_id: machine_id,
                activation_date: new Date().toISOString()
            })
            .eq('id', license.id);

        if (updateError) {
            console.error('更新激活码失败:', updateError);
            return { statusCode: 500, body: JSON.stringify({ status: 'failed', message: '激活失败，服务器数据库错误。' }) };
        }

        return { statusCode: 200, body: JSON.stringify({ status: 'valid', message: '软件激活成功！' }) };

    } catch (err) {
        console.error('激活函数出错:', err);
        return { statusCode: 500, body: JSON.stringify({ message: `服务器内部错误: ${err.message}` }) };
    }
};