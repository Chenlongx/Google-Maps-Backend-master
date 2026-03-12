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

function parseBooleanLike(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
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
    const tokensPerCny = Math.floor(Number(body.tokens_per_cny));
    const basis = String(body.basis || 'deepseek_1x').trim() || 'deepseek_1x';
    const enabled = parseBooleanLike(body.enabled, true);
    const remark = String(body.remark || '').trim() || null;

    if (!Number.isFinite(tokensPerCny) || tokensPerCny <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'tokens_per_cny must be a positive integer' })
      };
    }

    const payload = {
      key: 'ai_token_rate',
      value_json: {
        enabled,
        basis,
        tokens_per_cny: tokensPerCny
      },
      remark,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await adminClient
      .schema('whatsapp')
      .from('system_settings')
      .upsert(payload, { onConflict: 'key' })
      .select('key, value_json, remark, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Token rate updated successfully',
        data
      })
    };
  } catch (error) {
    console.error('updateWsTokenRate error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to update token rate'
      })
    };
  }
};
