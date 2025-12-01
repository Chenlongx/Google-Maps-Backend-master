// /netlify/functions/renewUserSubscription.js

const { createClient } = require('@supabase/supabase-js');

// 从环境变量中获取 Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { userId, months } = body;

        // 验证输入参数
        if (!userId) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ message: '缺少用户ID' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        if (!months || ![1, 2, 3, 6, 12].includes(months)) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ message: '无效的续费月数，必须是 1, 2, 3, 6, 或 12' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // 获取用户当前信息
        const { data: user, error: fetchError } = await supabase
            .from('user_accounts')
            .select('id, account, expiry_at')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            console.error('获取用户信息失败:', fetchError);
            return { 
                statusCode: 404, 
                body: JSON.stringify({ message: '用户不存在' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // 计算新的到期时间
        let baseDate;
        const now = new Date();
        
        if (user.expiry_at) {
            const expiryDate = new Date(user.expiry_at);
            // 如果当前到期时间还未过期，从到期时间开始续费
            // 如果已经过期，从当前时间开始续费
            baseDate = expiryDate > now ? expiryDate : now;
        } else {
            // 如果没有到期时间，从当前时间开始
            baseDate = now;
        }

        // 添加指定的月数
        const newExpiryDate = new Date(baseDate);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

        // 更新数据库
        const { data: updatedUser, error: updateError } = await supabase
            .from('user_accounts')
            .update({ expiry_at: newExpiryDate.toISOString() })
            .eq('id', userId)
            .select('id, account, expiry_at')
            .single();

        if (updateError) {
            console.error('更新用户到期时间失败:', updateError);
            return { 
                statusCode: 500, 
                body: JSON.stringify({ message: '更新失败: ' + updateError.message }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                success: true, 
                message: `成功续费 ${months} 个月`,
                user: updatedUser
            }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error('续费操作失败:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                message: '服务器内部错误', 
                error: error.message 
            }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};
