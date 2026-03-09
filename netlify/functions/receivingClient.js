const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

function isMissingPasswordHashColumnError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return code === 'PGRST204' || code === '42703' || message.includes('password_hash');
}

function isPasswordNotNullConstraintError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  const details = String(error.details || '');
  return code === '23502' && (message.includes('password') || details.includes('password'));
}

async function verifyPasswordWithFallback(inputPassword, user) {
  const passwordHash = typeof user.password_hash === 'string' ? user.password_hash : '';
  const legacyPassword = typeof user.password === 'string' ? user.password : '';

  if (passwordHash) {
    const isValid = await bcrypt.compare(inputPassword, passwordHash);
    return { ok: isValid, needsMigration: Boolean(legacyPassword), passwordHash };
  }

  if (legacyPassword) {
    const isValid = inputPassword === legacyPassword;
    return { ok: isValid, needsMigration: isValid, passwordHash: '' };
  }

  return { ok: false, needsMigration: false, passwordHash: '' };
}

async function migrateLegacyPasswordIfNeeded(userId, plainPassword, existingHash, shouldMigrate) {
  if (!shouldMigrate) return;

  const nextHash = existingHash || await bcrypt.hash(plainPassword, 10);

  let { error } = await supabase
    .from('user_accounts')
    .update({
      password_hash: nextHash,
      password: null
    })
    .eq('id', userId);

  if (error && isPasswordNotNullConstraintError(error)) {
    const fallbackUpdate = await supabase
      .from('user_accounts')
      .update({ password_hash: nextHash })
      .eq('id', userId);
    error = fallbackUpdate.error;
  }

  if (error && !isMissingPasswordHashColumnError(error)) {
    console.warn('Password migration warning:', error.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    const { username, password, device_id, os_type } = JSON.parse(event.body || '{}');

    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Username and password are required.' }),
        headers: RESPONSE_HEADERS
      };
    }

    const { data: user, error: fetchError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('account', username)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Database query error:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: `Database query failed: ${fetchError.message}` }),
        headers: RESPONSE_HEADERS
      };
    }

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, message: 'User not found.' }),
        headers: RESPONSE_HEADERS
      };
    }

    let authResult;
    try {
      authResult = await verifyPasswordWithFallback(password, user);
    } catch (passwordError) {
      console.error('Password verify error:', passwordError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: 'Password verification failed.' }),
        headers: RESPONSE_HEADERS
      };
    }

    if (!authResult.ok) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Invalid password.' }),
        headers: RESPONSE_HEADERS
      };
    }

    await migrateLegacyPasswordIfNeeded(user.id, password, authResult.passwordHash, authResult.needsMigration);

    if (!device_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing device_id.' }),
        headers: RESPONSE_HEADERS
      };
    }

    const storedDeviceId = user.device_id;

    if (!storedDeviceId) {
      const { error: updateError } = await supabase
        .from('user_accounts')
        .update({ device_id, os_type })
        .eq('id', user.id);

      if (updateError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, message: `Device bind failed: ${updateError.message}` }),
          headers: RESPONSE_HEADERS
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'First login successful, device bound.',
          user: {
            id: user.id,
            username: user.account,
            userType: user.user_type,
            expiryAt: user.expiry_at,
            status: user.status,
            deviceCode: device_id,
            osType: os_type,
            trial_search_used: user.trial_search_used,
            daily_export_count: user.daily_export_count
          }
        }),
        headers: RESPONSE_HEADERS
      };
    }

    if (storedDeviceId !== device_id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, message: 'Device mismatch.' }),
        headers: RESPONSE_HEADERS
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Login successful.',
        user: {
          id: user.id,
          username: user.account,
          userType: user.user_type,
          expiryAt: user.expiry_at,
          status: user.status,
          deviceCode: storedDeviceId,
          osType: user.os_type,
          trial_search_used: user.trial_search_used,
          daily_export_count: user.daily_export_count
        }
      }),
      headers: RESPONSE_HEADERS
    };
  } catch (error) {
    console.error('Login handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      headers: RESPONSE_HEADERS
    };
  }
};
