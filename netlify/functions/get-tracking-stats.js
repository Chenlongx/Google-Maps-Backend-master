/**
 * 获取追踪统计数据
 * GET /api/get-tracking-stats?campaign_id=123
 * GET /api/get-tracking-stats?user_id=xxx
 * 
 * 返回活动或用户的追踪统计
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
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        const campaignId = event.queryStringParameters?.campaign_id;
        const userId = event.queryStringParameters?.user_id;

        if (!campaignId && !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '请提供 campaign_id 或 user_id 参数'
                })
            };
        }

        // 1. 先获取该用户/活动的所有追踪令牌总数（真实收件人数）
        let totalRecipientsQuery = supabase
            .from('email_tracking_tokens')
            .select('id, campaign_id', { count: 'exact' });

        if (campaignId) {
            totalRecipientsQuery = totalRecipientsQuery.eq('campaign_id', parseInt(campaignId));
        }
        if (userId) {
            totalRecipientsQuery = totalRecipientsQuery.eq('user_id', userId);
        }

        const { count: totalRecipients, error: tokensError } = await totalRecipientsQuery;

        if (tokensError) {
            console.error('[GetStats] 查询令牌总数失败:', tokensError);
        }

        // 2. 获取追踪统计数据（有打开/点击记录的）
        let query = supabase
            .from('email_tracking_stats')
            .select('*')
            .order('last_activity_at', { ascending: false });

        if (campaignId) {
            query = query.eq('campaign_id', parseInt(campaignId));
        }

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: stats, error } = await query;

        if (error) {
            console.error('[GetStats] 查询失败:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: error.message })
            };
        }

        // 3. 计算汇总统计 - 使用真实收件人总数作为分母
        const actualTotalRecipients = totalRecipients || stats.length || 1;
        const uniqueOpens = stats.filter(s => s.open_count > 0).length;
        const uniqueClicks = stats.filter(s => s.click_count > 0).length;

        const summary = {
            total_recipients: actualTotalRecipients,
            total_opens: stats.reduce((sum, s) => sum + (s.open_count || 0), 0),
            total_clicks: stats.reduce((sum, s) => sum + (s.click_count || 0), 0),
            unique_opens: uniqueOpens,
            unique_clicks: uniqueClicks,
            open_rate: actualTotalRecipients > 0
                ? (uniqueOpens / actualTotalRecipients * 100).toFixed(2) + '%'
                : '0%',
            click_rate: actualTotalRecipients > 0
                ? (uniqueClicks / actualTotalRecipients * 100).toFixed(2) + '%'
                : '0%'
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                summary: summary,
                details: stats
            })
        };

    } catch (error) {
        console.error('[GetStats] 错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
