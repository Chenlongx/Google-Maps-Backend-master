/**
 * 生成邮件追踪令牌
 * POST /api/generate-tracking-token
 * 
 * 请求体: { campaign_id, recipient_email, user_id }
 * 返回: { token, pixel_url, expires_at }
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const TRACKING_SECRET = process.env.TRACKING_SECRET || 'default-tracking-secret-change-me';

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 生成安全的追踪令牌
function generateToken(campaignId, recipientEmail, userId) {
    const payload = `${campaignId}:${recipientEmail}:${userId}:${Date.now()}`;
    const hmac = crypto.createHmac('sha256', TRACKING_SECRET);
    hmac.update(payload);
    return hmac.digest('hex').substring(0, 32); // 32字符令牌
}

exports.handler = async function (event, context) {
    // CORS
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
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
        };
    }

    try {
        const { campaign_id, recipient_email, user_id, custom_domain } = JSON.parse(event.body || '{}');

        if (!campaign_id || !recipient_email || !user_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '缺少必要参数: campaign_id, recipient_email, user_id'
                })
            };
        }

        // 生成令牌
        const token = generateToken(campaign_id, recipient_email, user_id);

        // 7天过期
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // 检查是否已存在相同的追踪记录
        const { data: existing } = await supabase
            .from('email_tracking_tokens')
            .select('token')
            .eq('campaign_id', campaign_id)
            .eq('recipient_email', recipient_email)
            .single();

        let finalToken = token;

        if (existing) {
            // 已存在，返回现有令牌
            finalToken = existing.token;
        } else {
            // 插入新令牌
            const { error: insertError } = await supabase
                .from('email_tracking_tokens')
                .insert([{
                    token: token,
                    campaign_id: campaign_id,
                    recipient_email: recipient_email,
                    user_id: user_id,
                    expires_at: expiresAt
                }]);

            if (insertError) {
                console.error('插入追踪令牌失败:', insertError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: '创建追踪令牌失败',
                        error: insertError.message
                    })
                };
            }
        }

        // 构建追踪URL（支持用户自定义域名）
        const defaultUrl = process.env.URL || 'https://your-site.netlify.app';
        // 如果用户提供了自定义域名，使用它；否则使用默认域名
        const trackingDomain = custom_domain ? `https://${custom_domain.replace(/^https?:\/\//, '')}` : defaultUrl;
        const pixelUrl = `${trackingDomain}/api/track-open?t=${finalToken}`;
        const clickBaseUrl = `${trackingDomain}/api/track-click?t=${finalToken}&url=`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    token: finalToken,
                    pixel_url: pixelUrl,
                    click_base_url: clickBaseUrl,
                    pixel_html: `<img src="${pixelUrl}" width="1" height="1" alt="" style="opacity:0.01;border:0;margin:0;padding:0;" />`,
                    expires_at: expiresAt
                }
            })
        };

    } catch (error) {
        console.error('生成追踪令牌出错:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            })
        };
    }
};
