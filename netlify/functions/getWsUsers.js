const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

const PAID_ORDER_STATUSES = new Set([
    'PAID',
    'SUCCESS',
    'COMPLETED',
    'TRADE_SUCCESS',
    'TRADE_FINISHED'
]);

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function toTimestamp(value) {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function diffDays(from, to) {
    return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
}

function isPaidOrderStatus(status) {
    return PAID_ORDER_STATUSES.has(String(status || '').trim().toUpperCase());
}

function uniqueOrders(orders) {
    const seen = new Set();
    return orders.filter(order => {
        const key = String(order.out_trade_no || order.id || `${order.customer_email}-${order.created_at}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function pickSubscription(subscriptions, nowMs) {
    if (!subscriptions.length) return null;

    const activeSubscriptions = subscriptions
        .filter(subscription => {
            const status = String(subscription.status || '').toLowerCase();
            const endAt = toTimestamp(subscription.end_time);
            return status === 'active' && (!endAt || endAt > nowMs);
        })
        .sort((left, right) => {
            return (
                toTimestamp(right.end_time) - toTimestamp(left.end_time) ||
                toTimestamp(right.start_time) - toTimestamp(left.start_time) ||
                toTimestamp(right.created_at) - toTimestamp(left.created_at)
            );
        });

    if (activeSubscriptions.length) {
        return activeSubscriptions[0];
    }

    return [...subscriptions].sort((left, right) => {
        return (
            toTimestamp(right.end_time) - toTimestamp(left.end_time) ||
            toTimestamp(right.created_at) - toTimestamp(left.created_at) ||
            toTimestamp(right.start_time) - toTimestamp(left.start_time)
        );
    })[0];
}

function buildUsageMap(logs, weekStartMs) {
    const usageMap = new Map();

    logs.forEach(log => {
        const userId = log.user_id;
        if (!userId) return;

        const createdAtMs = toTimestamp(log.created_at);
        const totalTokens = toNumber(log.total_tokens) || (toNumber(log.input_tokens) + toNumber(log.output_tokens));
        const inputTokens = toNumber(log.input_tokens);
        const outputTokens = toNumber(log.output_tokens);

        const summary = usageMap.get(userId) || {
            month_input_tokens: 0,
            month_output_tokens: 0,
            month_total_tokens: 0,
            week_total_tokens: 0,
            last_ai_used_at: null,
            modelWeights: new Map(),
            featureWeights: new Map()
        };

        summary.month_input_tokens += inputTokens;
        summary.month_output_tokens += outputTokens;
        summary.month_total_tokens += totalTokens;

        if (createdAtMs >= weekStartMs) {
            summary.week_total_tokens += totalTokens;
        }

        if (!summary.last_ai_used_at || createdAtMs > toTimestamp(summary.last_ai_used_at)) {
            summary.last_ai_used_at = log.created_at;
        }

        if (log.model) {
            summary.modelWeights.set(log.model, (summary.modelWeights.get(log.model) || 0) + totalTokens);
        }

        if (log.feature_type) {
            summary.featureWeights.set(log.feature_type, (summary.featureWeights.get(log.feature_type) || 0) + totalTokens);
        }

        usageMap.set(userId, summary);
    });

    usageMap.forEach(summary => {
        summary.top_model = [...summary.modelWeights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
        summary.top_feature_type = [...summary.featureWeights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
        delete summary.modelWeights;
        delete summary.featureWeights;
    });

    return usageMap;
}

function buildOrderMap(orders) {
    const orderMap = new Map();

    orders.forEach(order => {
        const key = normalizeKey(order.customer_email);
        if (!key) return;

        if (!orderMap.has(key)) {
            orderMap.set(key, []);
        }

        orderMap.get(key).push(order);
    });

    return orderMap;
}

function getLatestOrderRecord(orders, includeOnlyPaid = false) {
    const filtered = includeOnlyPaid ? orders.filter(order => isPaidOrderStatus(order.status)) : orders;
    if (!filtered.length) return null;

    return [...filtered].sort((left, right) => {
        const leftTime = toTimestamp(left.paid_at || left.payment_time || left.updated_at || left.created_at);
        const rightTime = toTimestamp(right.paid_at || right.payment_time || right.updated_at || right.created_at);
        return rightTime - leftTime;
    })[0];
}

exports.handler = async function (event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
        };
    }

    try {
        const authorization = event.headers.authorization || event.headers.Authorization;
        const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

        if (!token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: '未授权，请重新登录。' })
            };
        }

        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData?.user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: '登录已过期，请重新登录。' })
            };
        }

        const now = new Date();
        const nowMs = now.getTime();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const weekStartMs = nowMs - 7 * 24 * 60 * 60 * 1000;

        const [profilesResult, subscriptionsResult, usageResult, ordersResult] = await Promise.all([
            adminClient
                .schema('whatsapp')
                .from('profiles')
                .select('id, email, nickname, avatar_url, role, balance, ai_balance, created_at, updated_at')
                .order('created_at', { ascending: false }),
            adminClient
                .schema('whatsapp')
                .from('subscriptions')
                .select('id, user_id, plan_key, status, start_time, end_time, created_at')
                .order('created_at', { ascending: false }),
            adminClient
                .schema('whatsapp')
                .from('ai_usage_logs')
                .select('user_id, model, feature_type, input_tokens, output_tokens, total_tokens, created_at')
                .gte('created_at', monthStart.toISOString()),
            adminClient
                .from('orders')
                .select('*')
                .ilike('product_id', 'whatsapp-validator%')
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (subscriptionsResult.error) throw subscriptionsResult.error;
        if (usageResult.error) throw usageResult.error;

        if (ordersResult.error) {
            console.warn('获取 WhatsApp 订单数据失败，将继续返回基础用户数据:', ordersResult.error.message);
        }

        const profiles = profilesResult.data || [];
        const subscriptions = subscriptionsResult.data || [];
        const usageLogs = usageResult.data || [];
        const orders = ordersResult.data || [];

        const subscriptionsByUser = new Map();
        subscriptions.forEach(subscription => {
            if (!subscription.user_id) return;
            if (!subscriptionsByUser.has(subscription.user_id)) {
                subscriptionsByUser.set(subscription.user_id, []);
            }
            subscriptionsByUser.get(subscription.user_id).push(subscription);
        });

        const usageByUser = buildUsageMap(usageLogs, weekStartMs);
        const ordersByKey = buildOrderMap(orders);

        const users = profiles.map(profile => {
            const userSubscriptions = subscriptionsByUser.get(profile.id) || [];
            const currentSubscription = pickSubscription(userSubscriptions, nowMs);
            const usageSummary = usageByUser.get(profile.id) || {
                month_input_tokens: 0,
                month_output_tokens: 0,
                month_total_tokens: 0,
                week_total_tokens: 0,
                last_ai_used_at: null,
                top_model: null,
                top_feature_type: null
            };

            const userOrders = uniqueOrders([
                ...(ordersByKey.get(normalizeKey(profile.email)) || []),
                ...(ordersByKey.get(normalizeKey(profile.id)) || [])
            ]);

            const latestPaidOrder = getLatestOrderRecord(userOrders, true);
            const latestAnyOrder = getLatestOrderRecord(userOrders, false);
            const activationTime = currentSubscription?.start_time || null;
            const expiryTime = currentSubscription?.end_time || null;
            const expiryMs = toTimestamp(expiryTime);
            const latestPaidOrderTime = latestPaidOrder
                ? (latestPaidOrder.paid_at || latestPaidOrder.payment_time || latestPaidOrder.updated_at || latestPaidOrder.created_at)
                : null;
            const latestOrderCreatedAt = latestAnyOrder?.created_at || null;
            const displayOrderTime = latestPaidOrderTime || latestOrderCreatedAt || currentSubscription?.created_at || null;

            const riskFlags = [];
            if (expiryMs && expiryMs <= nowMs) {
                riskFlags.push('已过期');
            } else if (expiryMs && diffDays(nowMs, expiryMs) <= 7) {
                riskFlags.push('7天内到期');
            }

            if (toNumber(profile.ai_balance) < 1000) {
                riskFlags.push('AI余额偏低');
            }

            if (!usageSummary.month_total_tokens) {
                riskFlags.push('本月未调用');
            }

            const normalizedSubscriptionStatus = currentSubscription
                ? (expiryMs && expiryMs <= nowMs ? 'expired' : String(currentSubscription.status || 'unknown').toLowerCase())
                : 'none';

            return {
                id: profile.id,
                email: profile.email || '',
                nickname: profile.nickname || '未命名用户',
                avatar_url: profile.avatar_url || '',
                role: profile.role || 'user',
                balance: toNumber(profile.balance),
                ai_balance: Math.trunc(toNumber(profile.ai_balance)),
                created_at: profile.created_at || null,
                updated_at: profile.updated_at || null,
                current_subscription_id: currentSubscription?.id || null,
                current_plan_key: currentSubscription?.plan_key || 'none',
                subscription_status: normalizedSubscriptionStatus,
                activation_time: activationTime,
                expiry_time: expiryTime,
                order_time: displayOrderTime,
                latest_order_created_at: latestOrderCreatedAt,
                latest_paid_order_time: latestPaidOrderTime,
                latest_order_status: latestAnyOrder?.status || null,
                latest_order_id: latestAnyOrder?.out_trade_no || latestAnyOrder?.id || null,
                order_count: userOrders.length,
                subscription_count: userSubscriptions.length,
                month_input_tokens: usageSummary.month_input_tokens,
                month_output_tokens: usageSummary.month_output_tokens,
                month_total_tokens: usageSummary.month_total_tokens,
                week_total_tokens: usageSummary.week_total_tokens,
                last_ai_used_at: usageSummary.last_ai_used_at,
                top_model: usageSummary.top_model,
                top_feature_type: usageSummary.top_feature_type,
                risk_flags: riskFlags
            };
        }).sort((left, right) => {
            return (
                toTimestamp(right.order_time) - toTimestamp(left.order_time) ||
                toTimestamp(right.expiry_time) - toTimestamp(left.expiry_time) ||
                toTimestamp(right.created_at) - toTimestamp(left.created_at)
            );
        });

        const metrics = users.reduce((summary, user) => {
            summary.total_users += 1;
            summary.total_month_tokens += user.month_total_tokens;
            summary.total_ai_balance += user.ai_balance;

            if (user.subscription_status === 'active') {
                summary.active_subscriptions += 1;
            }

            if (user.risk_flags.includes('7天内到期')) {
                summary.expiring_soon += 1;
            }

            if (user.latest_paid_order_time) {
                summary.paid_users += 1;
            }

            if (user.month_total_tokens >= 50000 || user.ai_balance >= 50000) {
                summary.high_value_users += 1;
            }

            return summary;
        }, {
            total_users: 0,
            active_subscriptions: 0,
            expiring_soon: 0,
            paid_users: 0,
            high_value_users: 0,
            total_month_tokens: 0,
            total_ai_balance: 0
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                metrics,
                users,
                generated_at: now.toISOString()
            })
        };
    } catch (error) {
        console.error('获取 WS 营销系统用户失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: error.message || '加载 WS 用户数据失败。'
            })
        };
    }
};
