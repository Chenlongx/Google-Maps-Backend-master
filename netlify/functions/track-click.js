/**
 * 邮件点击追踪
 * GET /api/track-click?t=TOKEN&url=ENCODED_URL
 * 
 * 记录点击后 302 重定向到目标 URL
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
    };

    try {
        const token = event.queryStringParameters?.t;
        const targetUrl = event.queryStringParameters?.url;

        // 如果没有目标 URL，返回错误
        if (!targetUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少目标URL' })
            };
        }

        // 解码 URL
        let decodedUrl;
        try {
            decodedUrl = decodeURIComponent(targetUrl);
        } catch (e) {
            decodedUrl = targetUrl;
        }

        // 如果没有令牌，直接重定向
        if (!token) {
            return {
                statusCode: 302,
                headers: { ...headers, 'Location': decodedUrl }
            };
        }

        // 验证令牌
        const { data: tokenData, error: tokenError } = await supabase
            .from('email_tracking_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (tokenError || !tokenData) {
            console.log('[TrackClick] 无效令牌，直接重定向');
            return {
                statusCode: 302,
                headers: { ...headers, 'Location': decodedUrl }
            };
        }

        // 检查过期
        if (new Date(tokenData.expires_at) < new Date()) {
            console.log('[TrackClick] 令牌已过期，直接重定向');
            return {
                statusCode: 302,
                headers: { ...headers, 'Location': decodedUrl }
            };
        }

        // 获取客户端信息
        const clientIp = (event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown')
            .split(',')[0].trim();
        const userAgent = event.headers['user-agent'] || 'unknown';

        // 写入追踪日志
        const { error: logError } = await supabase
            .from('email_tracking_logs')
            .insert([{
                token: token,
                event_type: 'click',
                ip_address: clientIp,
                user_agent: userAgent,
                clicked_url: decodedUrl,
                processed: false
            }]);

        if (logError) {
            console.error('[TrackClick] 记录日志失败:', logError);
        }

        // 更新配额计数
        const today = new Date().toISOString().split('T')[0];
        const { data: quota } = await supabase
            .from('user_tracking_quotas')
            .select('click_count')
            .eq('user_id', tokenData.user_id)
            .eq('date', today)
            .single();

        if (quota) {
            await supabase
                .from('user_tracking_quotas')
                .update({ click_count: (quota.click_count || 0) + 1 })
                .eq('user_id', tokenData.user_id)
                .eq('date', today);
        } else {
            await supabase
                .from('user_tracking_quotas')
                .insert([{
                    user_id: tokenData.user_id,
                    date: today,
                    open_count: 0,
                    click_count: 1
                }]);
        }

        console.log('[TrackClick] 成功记录点击:', {
            token: token.substring(0, 8) + '...',
            url: decodedUrl.substring(0, 50),
            ip: clientIp
        });

        // 302 重定向到目标URL
        return {
            statusCode: 302,
            headers: { ...headers, 'Location': decodedUrl }
        };

    } catch (error) {
        console.error('[TrackClick] 错误:', error);
        // 出错时尝试重定向
        const targetUrl = event.queryStringParameters?.url;
        if (targetUrl) {
            return {
                statusCode: 302,
                headers: { ...headers, 'Location': decodeURIComponent(targetUrl) }
            };
        }
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器错误' })
        };
    }
};
