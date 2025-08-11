const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            body: '',
        };
    }

    try {
        const { userIds } = JSON.parse(event.body);
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "无效的用户 ID 列表" }),
            };
        }

        // 调试：先查询确认状态
        const { data: users, error: selectError } = await supabase
            .from('user_accounts')
            .select('id, status')
            .in('id', userIds);

        if (selectError) {
            throw selectError;
        }

        console.log('待删除用户状态:', users);

        // 删除操作，去掉状态限制
        const { error: deleteError, data: deletedRows } = await supabase
            .from('user_accounts')
            .delete()
            .in('id', userIds)
            .select();  // 请求返回被删除的行

        if (deleteError) throw deleteError;

        const deletedCount = deletedRows ? deletedRows.length : 0;

        if (deletedCount === 0) {
            return {
                statusCode: 404,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "未找到匹配的用户进行删除" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ success: true, message: `成功删除 ${deletedCount} 个用户` }),
        };

    } catch (error) {
        console.error('删除用户时出错:', error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "删除用户时发生错误", error: error.message }),
        };
    }
};
