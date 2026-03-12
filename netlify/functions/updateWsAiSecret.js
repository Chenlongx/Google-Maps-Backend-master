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

async function requireAuthenticatedUser(event) {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    return { error: 'Unauthorized', statusCode: 401 };
  }

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData?.user) {
    return { error: 'Session expired', statusCode: 401 };
  }

  return { user: authData.user };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
    };
  }

  try {
    const auth = await requireAuthenticatedUser(event);
    if (auth.error) {
      return {
        statusCode: auth.statusCode,
        headers,
        body: JSON.stringify({ success: false, message: auth.error })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const key = String(body.key || '').trim();
    const value = String(body.value || '');

    if (!key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'Secret key is required' })
      };
    }

    const payload = {
      key,
      value
    };

    const { data, error } = await adminClient
      .schema('whatsapp')
      .from('secrets')
      .upsert(payload, { onConflict: 'key' })
      .select('key, created_at')
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'AI secret saved successfully',
        data
      })
    };
  } catch (error) {
    console.error('updateWsAiSecret error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to save AI secret'
      })
    };
  }
};
