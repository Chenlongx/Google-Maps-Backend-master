/**
 * 用户订阅续费
 * POST /api/renewUserSubscription
 * Body: { userId: string, months: number }
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

exports.handler = async function (event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { userId, months } = JSON.parse(event.body);

        if (!userId || !months || months < 1) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: '无效的参数' })
            };
        }

        // 1. 获取当前用户信息
        const { data: user, error: fetchError } = await supabase
            .from('user_accounts')
            .select('id, expiry_at')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, message: '用户不存在' })
            };
        }

        // 2. 计算新的到期时间
        let baseDate;
        if (user.expiry_at && new Date(user.expiry_at) > new Date()) {
            // 如果尚未过期，从当前到期时间开始续
            baseDate = new Date(user.expiry_at);
        } else {
            // 如果已过期，从现在开始续
            baseDate = new Date();
        }

        // 增加指定月数
        const newExpiryDate = new Date(baseDate);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

        // 3. 更新用户到期时间
        const { data: updatedUser, error: updateError } = await supabase
            .from('user_accounts')
            .update({ expiry_at: newExpiryDate.toISOString() })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        const monthsText = months === 1 ? '1个月' : months === 2 ? '2个月' : months === 3 ? '3个月' : months === 6 ? '半年' : '1年';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `续费成功！已续费${monthsText}`,
                user: updatedUser
            })
        };

    } catch (error) {
        console.error('[RenewUserSubscription] 错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: error.message })
        };
    }
};
