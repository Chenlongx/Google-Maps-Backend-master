/**
 * 邮件打开追踪
 * GET /api/track-open?t=TOKEN
 * 
 * 返回 1x1 透明 GIF 像素
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1x1 透明 GIF (最小的有效 GIF)
const TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

exports.handler = async function (event, context) {
    // 始终返回透明像素的响应头
    const pixelHeaders = {
        'Content-Type': 'image/gif',
        'Content-Length': TRANSPARENT_GIF.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
    };

    try {
        const token = event.queryStringParameters?.t;

        if (!token) {
            console.log('[TrackOpen] 缺少追踪令牌');
            return {
                statusCode: 200,
                headers: pixelHeaders,
                body: TRANSPARENT_GIF.toString('base64'),
                isBase64Encoded: true
            };
        }

        // 验证令牌
        const { data: tokenData, error: tokenError } = await supabase
            .from('email_tracking_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (tokenError || !tokenData) {
            console.log('[TrackOpen] 无效令牌:', token);
            return {
                statusCode: 200,
                headers: pixelHeaders,
                body: TRANSPARENT_GIF.toString('base64'),
                isBase64Encoded: true
            };
        }

        // 检查是否过期
        if (new Date(tokenData.expires_at) < new Date()) {
            console.log('[TrackOpen] 令牌已过期:', token);
            return {
                statusCode: 200,
                headers: pixelHeaders,
                body: TRANSPARENT_GIF.toString('base64'),
                isBase64Encoded: true
            };
        }

        // 检查用户配额 (免费用户每天5000次)
        const today = new Date().toISOString().split('T')[0];
        const { data: quota } = await supabase
            .from('user_tracking_quotas')
            .select('open_count')
            .eq('user_id', tokenData.user_id)
            .eq('date', today)
            .single();

        // 获取用户许可证类型 (使用 licenses 表)
        // user_id 存储的是 licenses 表的 key 字段 (字符串类型)
        const { data: licenseData } = await supabase
            .from('licenses')
            .select('id, key, status, expiry_date')
            .eq('key', tokenData.user_id)
            .single();

        // 判断是否付费用户: status='active' 且未过期
        const isPaid = licenseData?.status === 'active' &&
            (!licenseData?.expiry_date || new Date(licenseData.expiry_date) > new Date());
        const dailyLimit = isPaid ? Infinity : 5000;
        const currentCount = quota?.open_count || 0;

        if (currentCount >= dailyLimit) {
            console.log('[TrackOpen] 用户配额已用尽:', tokenData.user_id);
            // 仍然返回像素，但不记录
            return {
                statusCode: 200,
                headers: pixelHeaders,
                body: TRANSPARENT_GIF.toString('base64'),
                isBase64Encoded: true
            };
        }

        // 获取客户端信息
        const clientIp = (event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown')
            .split(',')[0].trim();
        const userAgent = event.headers['user-agent'] || 'unknown';

        // 写入追踪日志 (批量聚合表)
        const { error: logError } = await supabase
            .from('email_tracking_logs')
            .insert([{
                token: token,
                event_type: 'open',
                ip_address: clientIp,
                user_agent: userAgent,
                processed: false
            }]);

        if (logError) {
            console.error('[TrackOpen] 记录日志失败:', logError);
        }

        // 更新配额计数
        if (quota) {
            await supabase
                .from('user_tracking_quotas')
                .update({ open_count: currentCount + 1 })
                .eq('user_id', tokenData.user_id)
                .eq('date', today);
        } else {
            await supabase
                .from('user_tracking_quotas')
                .insert([{
                    user_id: tokenData.user_id,
                    date: today,
                    open_count: 1,
                    click_count: 0
                }]);
        }

        console.log('[TrackOpen] 成功记录打开事件:', {
            token: token.substring(0, 8) + '...',
            campaign_id: tokenData.campaign_id,
            ip: clientIp
        });

        return {
            statusCode: 200,
            headers: pixelHeaders,
            body: TRANSPARENT_GIF.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('[TrackOpen] 错误:', error);
        // 即使出错也返回像素
        return {
            statusCode: 200,
            headers: pixelHeaders,
            body: TRANSPARENT_GIF.toString('base64'),
            isBase64Encoded: true
        };
    }
};
