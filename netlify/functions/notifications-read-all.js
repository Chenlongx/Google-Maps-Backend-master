const {
    NOTIFICATION_TABLE,
    buildHeaders,
    getSupabaseClients,
    getAuthenticatedUser,
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

        const { count, error: countError } = await adminClient
            .from(NOTIFICATION_TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (countError) throw countError;

        if ((count || 0) > 0) {
            const { error: updateError } = await adminClient
                .from(NOTIFICATION_TABLE)
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (updateError) throw updateError;
        }

        return jsonResponse(200, headers, {
            success: true,
            updated_count: count || 0
        });
    } catch (error) {
        console.error('notifications-read-all: failed', error);
        return jsonResponse(500, headers, {
            success: false,
            message: error.message || 'Failed to mark all notifications as read.'
        });
    }
};

