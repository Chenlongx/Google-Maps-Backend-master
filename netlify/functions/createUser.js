const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function timeLimitToDate(timeLimit) {
  if (!timeLimit) return null;
  const now = new Date();
  switch (timeLimit) {
    case '1day':
      now.setDate(now.getDate() + 1);
      break;
    case '1week':
      now.setDate(now.getDate() + 7);
      break;
    case '1month':
      now.setMonth(now.getMonth() + 1);
      break;
    case '2months':
      now.setMonth(now.getMonth() + 2);
      break;
    case '3months':
      now.setMonth(now.getMonth() + 3);
      break;
    case '1year':
      now.setFullYear(now.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return now;
}

function permanentExpiryDate() {
  return new Date('9999-12-31T23:59:59Z');
}

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'POST only' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const account = (body.account || '').trim();
    const password = body.password || '';
    const userType = body.userType || body.user_type || '';
    const timeLimit = body.timeLimit || body.time_limit || null;
    const expiryDateRaw = body.expiryDate || body.expiry_date || null;

    if (!account || !password || !userType) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'account, password, userType are required' }) };
    }

    const { data: exists, error: fetchErr } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('account', account)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error('Supabase select error:', fetchErr);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Failed to check existing account', error: fetchErr.message }) };
    }
    if (exists) {
      return { statusCode: 409, body: JSON.stringify({ success: false, message: 'Account already exists' }) };
    }

    let expiryAt = null;

    if (expiryDateRaw) {
      const parsed = new Date(expiryDateRaw);
      if (!Number.isNaN(parsed.getTime())) {
        expiryAt = parsed;
      }
    }

    if (!expiryAt && timeLimit) {
      const fromTimeLimit = timeLimitToDate(timeLimit);
      if (fromTimeLimit) expiryAt = fromTimeLimit;
    }

    if (!expiryAt) {
      if (userType === 'trial') {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiryAt = d;
      } else if (userType === 'permanent') {
        expiryAt = permanentExpiryDate();
      } else if (userType === 'regular') {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        expiryAt = d;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiryAt = d;
      }
    }

    const createdAt = new Date();
    const passwordHash = await bcrypt.hash(password, 10);

    const secureUser = {
      account,
      password_hash: passwordHash,
      password: null,
      user_type: userType,
      created_at: createdAt.toISOString(),
      expiry_at: expiryAt.toISOString(),
      status: 'active'
    };

    let { data: insertData, error: insertErr } = await supabase
      .from('user_accounts')
      .insert(secureUser)
      .select('id, account');

    // Backward compatibility for old schemas:
    // - missing password_hash column
    // - password column is NOT NULL
    if (insertErr && (isMissingPasswordHashColumnError(insertErr) || isPasswordNotNullConstraintError(insertErr))) {
      const legacyUser = {
        ...secureUser,
        password
      };
      if (isMissingPasswordHashColumnError(insertErr)) {
        delete legacyUser.password_hash;
      }
      const fallbackInsert = await supabase
        .from('user_accounts')
        .insert(legacyUser)
        .select('id, account');
      insertErr = fallbackInsert.error;
      insertData = fallbackInsert.data;
    }

    if (insertErr) {
      console.error('Supabase insert error:', insertErr);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Failed to insert user', error: insertErr.message }) };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ success: true, message: 'User created', data: insertData })
    };
  } catch (err) {
    console.error('createUser handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Internal server error', error: err.message }) };
  }
};
