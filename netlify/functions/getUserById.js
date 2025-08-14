// /netlify/functions/getUserById.js

const { createClient } = require('@supabase/supabase-js');

// 从 Netlify 的环境变量中获取你的 Supabase URL 和 Service Role Key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
    // 只允许 GET 请求
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: '只支持 GET 请求' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // 从查询参数中获取用户 ID
    const userId = event.queryStringParameters.id;

    // 检查是否提供了用户 ID
    if (!userId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: '缺少用户 ID 参数' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        // 从 Supabase 的 'user_accounts' 表中查询指定 ID 的用户
        const { data, error } = await supabase
            .from('user_accounts')
            // .select('*')
            .select(`
                id, 
                account, 
                password, 
                device_id, 
                user_type, 
                created_at, 
                expiry_at, 
                status, 
                is_ai_authorized, 
                ai_tokens_remaining
            `)
            // 修复: 查询条件从 '.eq('_id', userId)' 改为 '.eq('id', userId)'
            // Supabase 默认主键是 'id'，而不是 MongoDB 的 '_id'
            .eq('id', userId) 
            .single(); // 期望只返回一条记录

        if (error) {
            // 如果查询出错，除了找不到记录的错误 (PGRST116)
            if (error.code === 'PGRST116') { // PGRST116 表示没有找到匹配的行
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: '未找到指定用户' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }
            throw error; // 其他错误则抛出
        }

        // 返回成功响应和用户数据
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, user: data }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error('获取用户详情失败:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message || '服务器内部错误' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};