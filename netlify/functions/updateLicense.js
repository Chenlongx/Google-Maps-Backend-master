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

const ALLOWED_STATUS = new Set(['available', 'active', 'revoked', 'expired']);

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
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: '未授权' }) };
        }

        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        if (userError || !userData?.user) {
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: '登录已过期，请重新登录。' }) };
        }

        const {
            id,
            status,
            customer_email: customerEmail,
            expiry_date: expiryDate
        } = JSON.parse(event.body || '{}');

        if (!id) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '缺少许可证 ID。' }) };
        }

        const updateData = {};

        if (status !== undefined) {
            if (!ALLOWED_STATUS.has(status)) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '状态不合法。' }) };
            }
            updateData.status = status;
        }

        if (customerEmail !== undefined) {
            const normalizedEmail = String(customerEmail || '').trim();
            if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '邮箱格式不正确。' }) };
            }
            updateData.customer_email = normalizedEmail || null;
        }

        if (expiryDate !== undefined) {
            if (!expiryDate) {
                updateData.expiry_date = null;
            } else {
                const parsedDate = new Date(expiryDate);
                if (Number.isNaN(parsedDate.getTime())) {
                    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '过期时间格式不正确。' }) };
                }
                updateData.expiry_date = parsedDate.toISOString();
            }
        }

        if (Object.keys(updateData).length === 0) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '没有可更新的字段。' }) };
        }

        const { data: license, error: updateError } = await adminClient
            .from('licenses')
            .update(updateData)
            .eq('id', id)
            .select('id, key, status, customer_email, created_at, activation_date, expiry_date')
            .single();

        if (updateError) {
            throw updateError;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: '许可证更新成功。',
                license
            })
        };
    } catch (error) {
        console.error('更新许可证失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: error.message || '更新失败。' })
        };
    }
};
