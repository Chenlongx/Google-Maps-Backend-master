/**
 * 获取邮件追踪使用情况
 * GET /api/get-email-tracking-usage
 * 
 * 返回各用户的追踪启用状态和使用量
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
        const today = new Date().toISOString().split('T')[0];

        // 1. 获取所有 licenses
        const { data: licenses, error: licensesError } = await supabase
            .from('licenses')
            .select('id, key, status, customer_email, created_at, activation_date, expiry_date')
            .order('created_at', { ascending: false });

        if (licensesError) {
            throw new Error('获取许可证列表失败: ' + licensesError.message);
        }

        // 2. 获取今日追踪配额使用情况
        const { data: quotas, error: quotasError } = await supabase
            .from('user_tracking_quotas')
            .select('user_id, open_count, click_count')
            .eq('date', today);

        // 3. 获取累计追踪统计
        const { data: stats, error: statsError } = await supabase
            .from('email_tracking_stats')
            .select('user_id, open_count, click_count');

        // 构建 user_id -> quota 映射
        const quotaMap = {};
        if (quotas) {
            quotas.forEach(q => {
                quotaMap[q.user_id] = {
                    today_opens: q.open_count || 0,
                    today_clicks: q.click_count || 0
                };
            });
        }

        // 构建 user_id -> 累计统计映射
        const statsMap = {};
        if (stats) {
            stats.forEach(s => {
                if (!statsMap[s.user_id]) {
                    statsMap[s.user_id] = { total_opens: 0, total_clicks: 0 };
                }
                statsMap[s.user_id].total_opens += s.open_count || 0;
                statsMap[s.user_id].total_clicks += s.click_count || 0;
            });
        }

        // 4. 组装结果
        let totalEnabled = 0;
        let todayTotalOpens = 0;
        let todayTotalClicks = 0;

        const result = licenses.map(license => {
            const key = license.key;
            const quota = quotaMap[key] || { today_opens: 0, today_clicks: 0 };
            const stat = statsMap[key] || { total_opens: 0, total_clicks: 0 };

            // 判断是否付费用户 (status='active' 且未过期)
            const isPaid = license.status === 'active' &&
                (!license.expiry_date || new Date(license.expiry_date) > new Date());

            // 追踪默认开启
            const trackingEnabled = true;
            if (trackingEnabled) totalEnabled++;

            todayTotalOpens += quota.today_opens;
            todayTotalClicks += quota.today_clicks;

            return {
                id: license.id,
                key: license.key,
                status: license.status,
                customer_email: license.customer_email,
                created_at: license.created_at,
                activation_date: license.activation_date,
                expiry_date: license.expiry_date,
                tracking_enabled: trackingEnabled,
                is_paid: isPaid,
                quota_limit: isPaid ? 0 : 5000,  // 0 = 无限制
                today_opens: quota.today_opens,
                today_clicks: quota.today_clicks,
                total_opens: stat.total_opens,
                total_clicks: stat.total_clicks
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                licenses: result,
                summary: {
                    total_licenses: licenses.length,
                    total_enabled: totalEnabled,
                    today_total_opens: todayTotalOpens,
                    today_total_clicks: todayTotalClicks
                }
            })
        };

    } catch (error) {
        console.error('[GetEmailTrackingUsage] 错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
