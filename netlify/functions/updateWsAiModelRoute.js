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

function toNumber(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    const modelId = String(body.model_id || '').trim();
    const displayName = String(body.display_name || '').trim();
    const description = String(body.description || '').trim() || null;
    const providerKey = String(body.provider_key || '').trim();
    const upstreamModel = String(body.upstream_model || '').trim();
    const priceMultiplier = toNumber(body.price_multiplier, 1);
    const enabled = toBoolean(body.enabled, true);
    const isVisible = toBoolean(body.is_visible, true);
    const isDefault = toBoolean(body.is_default, false);
    const supportsChat = toBoolean(body.supports_chat, true);
    const supportsTranslate = toBoolean(body.supports_translate, false);
    const supportsWarmup = toBoolean(body.supports_warmup, false);
    const supportsVoice = toBoolean(body.supports_voice, false);
    const iconType = String(body.icon_type || '').trim() || null;
    const colorClass = String(body.color_class || '').trim() || null;
    const bgClass = String(body.bg_class || '').trim() || null;
    const sortOrder = toInteger(body.sort_order, 100);
    const metaJson = body.meta_json && typeof body.meta_json === 'object' && !Array.isArray(body.meta_json)
      ? body.meta_json
      : {};

    if (!modelId || !displayName || !providerKey || !upstreamModel) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'model_id, display_name, provider_key and upstream_model are required' })
      };
    }

    const payload = {
      model_id: modelId,
      display_name: displayName,
      description,
      provider_key: providerKey,
      upstream_model: upstreamModel,
      price_multiplier: priceMultiplier,
      enabled,
      is_visible: isVisible,
      is_default: isDefault,
      supports_chat: supportsChat,
      supports_translate: supportsTranslate,
      supports_warmup: supportsWarmup,
      supports_voice: supportsVoice,
      icon_type: iconType,
      color_class: colorClass,
      bg_class: bgClass,
      sort_order: sortOrder,
      meta_json: metaJson,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await adminClient
      .schema('whatsapp')
      .from('ai_model_routes')
      .upsert(payload, { onConflict: 'model_id' })
      .select('model_id,display_name,description,provider_key,upstream_model,price_multiplier,enabled,is_visible,is_default,supports_chat,supports_translate,supports_warmup,supports_voice,icon_type,color_class,bg_class,sort_order,meta_json,updated_at')
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'AI model route saved successfully',
        data
      })
    };
  } catch (error) {
    console.error('updateWsAiModelRoute error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Failed to save AI model route'
      })
    };
  }
};
