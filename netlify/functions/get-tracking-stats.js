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

        // 计算汇总统计
        const summary = {
            total_recipients: stats.length,
            total_opens: stats.reduce((sum, s) => sum + (s.open_count || 0), 0),
            total_clicks: stats.reduce((sum, s) => sum + (s.click_count || 0), 0),
            unique_opens: stats.filter(s => s.open_count > 0).length,
            unique_clicks: stats.filter(s => s.click_count > 0).length,
            open_rate: stats.length > 0
                ? (stats.filter(s => s.open_count > 0).length / stats.length * 100).toFixed(2) + '%'
                : '0%',
            click_rate: stats.length > 0
                ? (stats.filter(s => s.click_count > 0).length / stats.length * 100).toFixed(2) + '%'
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
