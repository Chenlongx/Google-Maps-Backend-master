// /netlify/functions/updateUser.js

const { createClient } = require('@supabase/supabase-js');

// 从环境变量中获取 Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { id } = body;

        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing user ID' }) };
        }

        // 只保留数据库存在的字段
        const allowedFields = ['account', 'password', 'device_id', 'user_type', 'created_at', 'expiry_at', 'status'];
        const updateData = {};

        for (const key of allowedFields) {
            if (body[key] !== undefined) {
                updateData[key] = body[key];
            }
        }

        const { data, error } = await supabase
            .from('user_accounts')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Supabase update error:', error);
            return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Failed to update user:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error', error: error.message }) };
    }
};
