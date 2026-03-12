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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

function normalizeJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      return {};
    }
  }
  return {};
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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

    const [providersResult, routesResult, secretsResult] = await Promise.all([
      adminClient
        .schema('whatsapp')
        .from('ai_providers')
        .select('provider_key,label,base_url,api_path,auth_type,secret_key_ref,request_format,enabled,is_relay,priority,meta_json,updated_at')
        .order('priority', { ascending: true })
        .order('provider_key', { ascending: true }),
      adminClient
        .schema('whatsapp')
        .from('ai_model_routes')
        .select('model_id,display_name,description,provider_key,upstream_model,price_multiplier,enabled,is_visible,is_default,supports_chat,supports_translate,supports_warmup,supports_voice,icon_type,color_class,bg_class,sort_order,meta_json,updated_at')
        .order('sort_order', { ascending: true })
        .order('model_id', { ascending: true }),
      adminClient
        .schema('whatsapp')
        .from('secrets')
        .select('key, created_at')
        .order('key', { ascending: true })
    ]);

    if (providersResult.error) throw providersResult.error;
    if (routesResult.error) throw routesResult.error;
    if (secretsResult.error) throw secretsResult.error;

    const providers = (providersResult.data || []).map((item) => ({
      ...item,
      meta_json: normalizeJson(item.meta_json)
    }));
    const routes = (routesResult.data || []).map((item) => ({
      ...item,
      meta_json: normalizeJson(item.meta_json)
    }));
    const secretKeys = (secretsResult.data || []).map((item) => ({
      key: item.key,
      created_at: item.created_at
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          providers,
          routes,
          secret_keys: secretKeys
        }
      })
    };
  } catch (error) {
    console.error('getWsAiRoutingConfig error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to load AI routing config'
      })
    };
  }
};
