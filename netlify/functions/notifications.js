const {
    NOTIFICATION_TABLE,
    buildHeaders,
    getSupabaseClients,
    getAuthenticatedUser,
    jsonResponse
} = require('./_utils/notificationCommon');

const headers = buildHeaders('GET');
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(rawValue, fallbackValue) {
    const value = Number.parseInt(String(rawValue ?? ''), 10);
    if (!Number.isFinite(value) || value < 0) return fallbackValue;
    return value;
}

exports.handler = async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, headers, { success: false, message: 'Method Not Allowed' });
    }

    try {
        const { user, errorResponse } = await getAuthenticatedUser(event);
        if (errorResponse) {
            return jsonResponse(errorResponse.statusCode, headers, { success: false, message: errorResponse.message });
        }
        const { adminClient } = getSupabaseClients();

        const queryString = event.queryStringParameters || {};
        const limit = Math.min(parsePositiveInt(queryString.limit, DEFAULT_LIMIT), MAX_LIMIT);
        const offset = parsePositiveInt(queryString.offset, 0);

        const [listResult, unreadCountResult] = await Promise.all([
            adminClient
                .from(NOTIFICATION_TABLE)
                .select('id, type, title, message, link, metadata, is_read, created_at, read_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1),
            adminClient
                .from(NOTIFICATION_TABLE)
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
        ]);

        if (listResult.error) throw listResult.error;
        if (unreadCountResult.error) throw unreadCountResult.error;

        return jsonResponse(200, headers, {
            success: true,
            notifications: listResult.data || [],
            unread_count: unreadCountResult.count || 0
        });
    } catch (error) {
        console.error('notifications: failed to load notifications', error);
        return jsonResponse(500, headers, {
            success: false,
            message: error.message || 'Failed to load notifications.'
        });
    }
};
