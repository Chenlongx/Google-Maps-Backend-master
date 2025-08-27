// functions/generateLicense.js (已修正，可与 service_role 密钥协同工作)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// 确保这里使用的是您在 Netlify 中配置的 service_role 密钥的环境变量名
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    // 身份验证逻辑保持不变
    const { password, count } = JSON.parse(event.body);
    if (password !== process.env.ADMIN_PASSWORD) {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '未授权' }) };
    }

    if (!count || count <= 0 || count > 100) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: '请输入一个1到100之间的有效数量。' }) };
    }

    try {
        // --- 核心修改点：在这里主动生成激活码 ---

        const licensesToInsert = [];
        // 循环 "count" 次
        for (let i = 0; i < count; i++) {
            // 使用 supabase.rpc() 主动调用您在数据库中创建的函数
            const { data: newKey, error: rpcError } = await supabase.rpc('generate_license_key');

            if (rpcError) {
                // 如果函数调用失败，则抛出错误
                throw new Error(`调用数据库函数失败: ${rpcError.message}`);
            }

            // 将生成的新码和其他预设值一起构建成一个完整的对象
            licensesToInsert.push({
                key: newKey,
                notes: '由后台批量生成'
                // 您也可以在这里设置 expiry_date 等
            });
        }
        // --- 修改结束 ---

        // 将包含了完整数据的数组一次性插入数据库
        const { error } = await supabase
            .from('licenses')
            .insert(licensesToInsert);

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `成功生成 ${count} 个激活码！` })
        };

    } catch (err) {
        console.error('生成激活码失败:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: `生成失败: ${err.message}` })
        };
    }
};