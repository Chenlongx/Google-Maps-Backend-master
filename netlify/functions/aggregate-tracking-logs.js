/**
 * 批量聚合追踪日志到统计表
 * POST /api/aggregate-tracking-logs
 * 
 * 定时任务调用 (每5分钟)
 * 将 email_tracking_logs 中未处理的记录聚合到 email_tracking_stats
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
        "Content-Type": "application/json"
    };

    try {
        console.log('[Aggregate] 开始批量聚合追踪日志...');

        // 1. 获取所有未处理的日志 (限制1000条防止超时)
        const { data: logs, error: logsError } = await supabase
            .from('email_tracking_logs')
            .select('*')
            .eq('processed', false)
            .order('created_at', { ascending: true })
            .limit(1000);

        if (logsError) {
            console.error('[Aggregate] 获取日志失败:', logsError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: logsError.message })
            };
        }

        if (!logs || logs.length === 0) {
            console.log('[Aggregate] 没有待处理的日志');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, processed: 0, message: '没有待处理的日志' })
            };
        }

        console.log(`[Aggregate] 找到 ${logs.length} 条待处理日志`);

        // 2. 按 token 分组聚合
        const tokenGroups = {};
        for (const log of logs) {
            if (!tokenGroups[log.token]) {
                tokenGroups[log.token] = {
                    opens: 0,
                    clicks: 0,
                    first_open_at: null,
                    last_activity_at: null,
                    log_ids: []
                };
            }

            const group = tokenGroups[log.token];
            group.log_ids.push(log.id);

            if (log.event_type === 'open') {
                group.opens++;
                if (!group.first_open_at) {
                    group.first_open_at = log.created_at;
                }
            } else if (log.event_type === 'click') {
                group.clicks++;
            }

            group.last_activity_at = log.created_at;
        }

        console.log(`[Aggregate] 分组后有 ${Object.keys(tokenGroups).length} 个令牌`);

        // 3. 更新统计表
        let processedCount = 0;
        let errorCount = 0;

        for (const [token, group] of Object.entries(tokenGroups)) {
            try {
                // 获取令牌信息
                const { data: tokenData } = await supabase
                    .from('email_tracking_tokens')
                    .select('user_id, campaign_id, recipient_email')
                    .eq('token', token)
                    .single();

                if (!tokenData) {
                    console.log(`[Aggregate] 令牌 ${token.substring(0, 8)}... 不存在，跳过`);
                    continue;
                }

                // 查找或创建统计记录
                const { data: existingStat } = await supabase
                    .from('email_tracking_stats')
                    .select('*')
                    .eq('campaign_id', tokenData.campaign_id)
                    .eq('recipient_email', tokenData.recipient_email)
                    .single();

                if (existingStat) {
                    // 更新现有记录
                    await supabase
                        .from('email_tracking_stats')
                        .update({
                            open_count: (existingStat.open_count || 0) + group.opens,
                            click_count: (existingStat.click_count || 0) + group.clicks,
                            last_activity_at: group.last_activity_at
                        })
                        .eq('id', existingStat.id);
                } else {
                    // 创建新记录
                    await supabase
                        .from('email_tracking_stats')
                        .insert([{
                            user_id: tokenData.user_id,
                            campaign_id: tokenData.campaign_id,
                            recipient_email: tokenData.recipient_email,
                            first_open_at: group.first_open_at,
                            open_count: group.opens,
                            click_count: group.clicks,
                            last_activity_at: group.last_activity_at
                        }]);
                }

                // 标记日志为已处理
                await supabase
                    .from('email_tracking_logs')
                    .update({ processed: true })
                    .in('id', group.log_ids);

                processedCount += group.log_ids.length;

            } catch (e) {
                console.error(`[Aggregate] 处理令牌 ${token.substring(0, 8)}... 失败:`, e);
                errorCount++;
            }
        }

        console.log(`[Aggregate] 完成: 处理 ${processedCount} 条, 错误 ${errorCount} 条`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                processed: processedCount,
                errors: errorCount,
                tokens: Object.keys(tokenGroups).length
            })
        };

    } catch (error) {
        console.error('[Aggregate] 错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
