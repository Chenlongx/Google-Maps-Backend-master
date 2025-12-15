/**
 * 同步追踪数据并标记已同步
 * GET /api/sync-tracking-data?user_id=xxx
 * 
 * 返回用户的累计追踪统计，并标记这些记录为已同步
 * 便于前端保存到本地后，云端可以清理
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        const userId = event.queryStringParameters?.user_id;
        const markSynced = event.queryStringParameters?.mark_synced === 'true';

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '请提供 user_id 参数'
                })
            };
        }

        // 1. 获取该用户所有未同步的统计数据
        const { data: stats, error: statsError } = await supabase
            .from('email_tracking_stats')
            .select('*')
            .eq('user_id', userId)
            .or('synced.is.null,synced.eq.false');

        if (statsError) {
            throw new Error('获取统计数据失败: ' + statsError.message);
        }

        // 2. 计算汇总
        const summary = {
            total_recipients: stats?.length || 0,
            total_opens: 0,
            total_clicks: 0,
            unique_opens: 0,
            unique_clicks: 0,
            campaigns: {}
        };

        if (stats) {
            stats.forEach(s => {
                summary.total_opens += s.open_count || 0;
                summary.total_clicks += s.click_count || 0;
                if (s.open_count > 0) summary.unique_opens++;
                if (s.click_count > 0) summary.unique_clicks++;

                // 按活动分组统计
                const campId = s.campaign_id;
                if (!summary.campaigns[campId]) {
                    summary.campaigns[campId] = {
                        recipients: 0,
                        opens: 0,
                        clicks: 0
                    };
                }
                summary.campaigns[campId].recipients++;
                summary.campaigns[campId].opens += s.open_count || 0;
                summary.campaigns[campId].clicks += s.click_count || 0;
            });
        }

        // 计算打开率和点击率
        summary.open_rate = summary.total_recipients > 0
            ? (summary.unique_opens / summary.total_recipients * 100).toFixed(2) + '%'
            : '0%';
        summary.click_rate = summary.total_recipients > 0
            ? (summary.unique_clicks / summary.total_recipients * 100).toFixed(2) + '%'
            : '0%';

        // 3. 如果请求标记同步，则更新记录
        let syncedCount = 0;
        if (markSynced && stats && stats.length > 0) {
            const ids = stats.map(s => s.id);

            const { error: updateError } = await supabase
                .from('email_tracking_stats')
                .update({ synced: true, synced_at: new Date().toISOString() })
                .in('id', ids);

            if (!updateError) {
                syncedCount = ids.length;
                console.log(`[SyncTracking] 标记 ${syncedCount} 条记录为已同步`);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user_id: userId,
                summary: summary,
                details: stats || [],
                synced_count: syncedCount,
                sync_time: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[SyncTracking] 错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
