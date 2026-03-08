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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

const ALLOWED_SUBSCRIPTION_STATUS = new Set(['active', 'expired', 'cancelled', 'pending', 'paused']);

function normalizeNullableText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function parseNumberField(value, fieldName, { integer = false, min = null } = {}) {
    if (value === undefined) return { hasValue: false };
    if (value === null || value === '') return { hasValue: true, value: null };

    const parsed = integer ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} 必须是数字。`);
    }
    if (min !== null && parsed < min) {
        throw new Error(`${fieldName} 不能小于 ${min}。`);
    }

    return { hasValue: true, value: parsed };
}

function parseDateField(value, fieldName) {
    if (value === undefined) return { hasValue: false };
    if (value === null || value === '') return { hasValue: true, value: null };

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new Error(`${fieldName} 格式不正确。`);
    }

    return { hasValue: true, value: parsedDate.toISOString() };
}

exports.handler = async function (event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
    }

    try {
        const authorization = event.headers.authorization || event.headers.Authorization;
        const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

        if (!token) {
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: '未授权。' }) };
        }

        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData?.user) {
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: '登录已过期，请重新登录。' }) };
        }

        const payload = JSON.parse(event.body || '{}');
        const {
            id,
            email,
            nickname,
            avatar_url: avatarUrl,
            role,
            user_type: userType,
            balance,
            ai_balance: aiBalance,
            current_subscription_id: subscriptionId,
            current_plan_key: planKey,
            subscription_status: subscriptionStatus,
            activation_time: activationTime,
            expiry_time: expiryTime
        } = payload;

        if (!id) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '缺少用户 ID。' }) };
        }

        const profileUpdate = {};

        if (email !== undefined) {
            const normalizedEmail = String(email || '').trim().toLowerCase();
            if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '邮箱格式不正确。' }) };
            }
            profileUpdate.email = normalizedEmail || null;
        }

        if (nickname !== undefined) {
            profileUpdate.nickname = normalizeNullableText(nickname);
        }

        if (avatarUrl !== undefined) {
            profileUpdate.avatar_url = normalizeNullableText(avatarUrl);
        }

        if (role !== undefined) {
            profileUpdate.role = normalizeNullableText(role) || 'user';
        }

        const balanceField = parseNumberField(balance, '账户余额');
        if (balanceField.hasValue) {
            profileUpdate.balance = balanceField.value;
        }

        const aiBalanceField = parseNumberField(aiBalance, 'AI 余额', { integer: true, min: 0 });
        if (aiBalanceField.hasValue) {
            profileUpdate.ai_balance = aiBalanceField.value;
        }

        if (Object.keys(profileUpdate).length > 0) {
            profileUpdate.updated_at = new Date().toISOString();
        }

        const subscriptionUpdate = {};
        const normalizedPlanKey = normalizeNullableText(planKey);

        if (planKey !== undefined) {
            if (normalizedPlanKey) {
                subscriptionUpdate.plan_key = normalizedPlanKey;
            }
        }

        const normalizedSubscriptionStatus = String(subscriptionStatus || '').trim().toLowerCase();
        if (subscriptionStatus !== undefined) {
            if (normalizedSubscriptionStatus && !ALLOWED_SUBSCRIPTION_STATUS.has(normalizedSubscriptionStatus)) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '订阅状态不合法。' }) };
            }
            if (normalizedSubscriptionStatus) {
                subscriptionUpdate.status = normalizedSubscriptionStatus;
            }
        }

        const activationField = parseDateField(activationTime, '开通时间');
        if (activationField.hasValue) {
            subscriptionUpdate.start_time = activationField.value;
        }

        const expiryField = parseDateField(expiryTime, '到期时间');
        if (expiryField.hasValue) {
            subscriptionUpdate.end_time = expiryField.value;
        }

        const normalizedUserType = String(userType || '').trim().toLowerCase();
        const shouldDowngradeToFree = normalizedUserType === 'free';

        let updatedProfile = null;
        let updatedSubscription = null;

        if (Object.keys(profileUpdate).length > 0) {
            const { data, error } = await adminClient
                .schema('whatsapp')
                .from('profiles')
                .update(profileUpdate)
                .eq('id', id)
                .select('id, email, nickname, avatar_url, role, balance, ai_balance, created_at, updated_at')
                .single();

            if (error) throw error;
            updatedProfile = data;
        }

        const hasSubscriptionChange = Object.keys(subscriptionUpdate).length > 0;

        if (subscriptionId && shouldDowngradeToFree) {
            const freeDowngradePatch = {
                status: 'expired',
                end_time: Object.prototype.hasOwnProperty.call(subscriptionUpdate, 'end_time')
                    ? subscriptionUpdate.end_time
                    : new Date().toISOString()
            };

            const { data, error } = await adminClient
                .schema('whatsapp')
                .from('subscriptions')
                .update(freeDowngradePatch)
                .eq('id', subscriptionId)
                .eq('user_id', id)
                .select('id, user_id, plan_key, status, start_time, end_time, created_at')
                .single();

            if (error) throw error;
            updatedSubscription = data;
        } else if (hasSubscriptionChange) {
            if (subscriptionId) {
                const { data, error } = await adminClient
                    .schema('whatsapp')
                    .from('subscriptions')
                    .update(subscriptionUpdate)
                    .eq('id', subscriptionId)
                    .eq('user_id', id)
                    .select('id, user_id, plan_key, status, start_time, end_time, created_at')
                    .single();

                if (error) throw error;
                updatedSubscription = data;
            } else {
                const insertPayload = {
                    user_id: id,
                    plan_key: subscriptionUpdate.plan_key || 'basic',
                    status: subscriptionUpdate.status || 'active',
                    start_time: subscriptionUpdate.start_time || new Date().toISOString(),
                    end_time: Object.prototype.hasOwnProperty.call(subscriptionUpdate, 'end_time')
                        ? subscriptionUpdate.end_time
                        : null
                };

                const { data, error } = await adminClient
                    .schema('whatsapp')
                    .from('subscriptions')
                    .insert(insertPayload)
                    .select('id, user_id, plan_key, status, start_time, end_time, created_at')
                    .single();

                if (error) throw error;
                updatedSubscription = data;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'WS 用户信息更新成功。',
                profile: updatedProfile,
                subscription: updatedSubscription
            })
        };
    } catch (error) {
        console.error('更新 WS 用户失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: error.message || '更新 WS 用户失败。' })
        };
    }
};
