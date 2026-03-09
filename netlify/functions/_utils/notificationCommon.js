const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NOTIFICATION_TABLE = 'admin_notifications';

let cachedClients = null;

const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

function buildHeaders(methods) {
    return {
        ...commonHeaders,
        'Access-Control-Allow-Methods': `${methods}, OPTIONS`
    };
}

function getToken(event) {
    const authorization = event.headers?.authorization || event.headers?.Authorization || '';
    if (!authorization.startsWith('Bearer ')) return '';
    return authorization.slice(7).trim();
}

function getSupabaseClients() {
    if (cachedClients) return cachedClients;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    });

    cachedClients = { authClient, adminClient };
    return cachedClients;
}

async function getAuthenticatedUser(event) {
    const token = getToken(event);
    if (!token) {
        return { user: null, errorResponse: { statusCode: 401, message: 'Unauthorized' } };
    }

    const { authClient } = getSupabaseClients();
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
        return { user: null, errorResponse: { statusCode: 401, message: 'Session expired, please login again.' } };
    }

    return { user: data.user, errorResponse: null };
}

function parseJsonBody(event) {
    if (!event.body) return {};
    try {
        return JSON.parse(event.body);
    } catch (error) {
        throw new Error('Invalid JSON body.');
    }
}

function jsonResponse(statusCode, headers, payload) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(payload)
    };
}

module.exports = {
    NOTIFICATION_TABLE,
    buildHeaders,
    getSupabaseClients,
    getAuthenticatedUser,
    parseJsonBody,
    jsonResponse
};
