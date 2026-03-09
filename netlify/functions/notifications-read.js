const {
    NOTIFICATION_TABLE,
    buildHeaders,
    getSupabaseClients,
    getAuthenticatedUser,
    parseJsonBody,
    jsonResponse
} = require('./_utils/notificationCommon');

const headers = buildHeaders('POST');

exports.handler = async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, headers, { success: false, message: 'Method Not Allowed' });
    }

    try {
        const { user, errorResponse } = await getAuthenticatedUser(event);
        if (errorResponse) {
            return jsonResponse(errorResponse.statusCode, headers, { success: false, message: errorResponse.message });
        }
        const { adminClient } = getSupabaseClients();

        const body = parseJsonBody(event);
        const notificationId = Number.parseInt(String(body.id ?? ''), 10);

        if (!Number.isFinite(notificationId) || notificationId <= 0) {
            return jsonResponse(400, headers, { success: false, message: 'Invalid notification id.' });
        }

        const { data, error } = await adminClient
            .from(NOTIFICATION_TABLE)
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', user.id)
            .select('id, is_read, read_at')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return jsonResponse(404, headers, { success: false, message: 'Notification not found.' });
        }

        return jsonResponse(200, headers, {
            success: true,
            notification: data
        });
    } catch (error) {
        console.error('notifications-read: failed', error);
        return jsonResponse(500, headers, {
            success: false,
            message: error.message || 'Failed to mark notification as read.'
        });
    }
};

