const {
    NOTIFICATION_TABLE,
    buildHeaders,
    getSupabaseClients,
    getAuthenticatedUser,
    jsonResponse
} = require('./_utils/notificationCommon');

const headers = buildHeaders('GET');

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

        const { count, error } = await adminClient
            .from(NOTIFICATION_TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) throw error;

        return jsonResponse(200, headers, {
            success: true,
            unread_count: count || 0
        });
    } catch (error) {
        console.error('notifications-unread-count: failed', error);
        return jsonResponse(500, headers, {
            success: false,
            message: error.message || 'Failed to load unread count.'
        });
    }
};

