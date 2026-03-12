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

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toInteger(value, fallback = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
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
    const providerKey = String(body.provider_key || '').trim();
    const label = String(body.label || '').trim();
    const baseUrl = String(body.base_url || '').trim();
    const apiPath = String(body.api_path || '/chat/completions').trim() || '/chat/completions';
    const authType = String(body.auth_type || 'bearer').trim() || 'bearer';
    const secretKeyRef = String(body.secret_key_ref || '').trim() || null;
    const requestFormat = String(body.request_format || 'openai_compatible').trim() || 'openai_compatible';
    const enabled = toBoolean(body.enabled, true);
    const isRelay = toBoolean(body.is_relay, false);
    const priority = toInteger(body.priority, 100);
    const metaJson = body.meta_json && typeof body.meta_json === 'object' && !Array.isArray(body.meta_json)
      ? body.meta_json
      : {};

    if (!providerKey || !label || !baseUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'provider_key, label and base_url are required' })
      };
    }

    const payload = {
      provider_key: providerKey,
      label,
      base_url: baseUrl,
      api_path: apiPath,
      auth_type: authType,
      secret_key_ref: secretKeyRef,
      request_format: requestFormat,
      enabled,
      is_relay: isRelay,
      priority,
      meta_json: metaJson,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await adminClient
      .schema('whatsapp')
      .from('ai_providers')
      .upsert(payload, { onConflict: 'provider_key' })
      .select('provider_key,label,base_url,api_path,auth_type,secret_key_ref,request_format,enabled,is_relay,priority,meta_json,updated_at')
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'AI provider saved successfully',
        data
      })
    };
  } catch (error) {
    console.error('updateWsAiProvider error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to save AI provider'
      })
    };
  }
};
