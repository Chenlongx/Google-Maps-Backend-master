const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
  }

  try {
    const { email, password, token, device_id, os_type, invite_code } = JSON.parse(event.body || '{}');

    if (!email || !password || !token || !device_id || !os_type) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing required fields.' }) };
    }

    const { data: existingDevice, error: deviceCheckError } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('device_id', device_id)
      .maybeSingle();

    if (deviceCheckError) {
      console.error('Error checking device ID:', deviceCheckError);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Database query failed.' }) };
    }

    if (existingDevice) {
      return { statusCode: 409, body: JSON.stringify({ success: false, message: 'This device has already registered a trial account.' }) };
    }

    const {
      data: { user },
      error: verifyError
    } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (verifyError || !user) {
      console.error('Supabase OTP verification error:', verifyError);
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid or expired verification code.' }) };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);

    const secureUserRecord = {
      account: email,
      password_hash: hashedPassword,
      password: null,
      device_id,
      os_type,
      user_type: 'standard',
      status: 'active',
      expiry_at: expiryDate.toISOString(),
      is_ai_authorized: false,
      ai_tokens_remaining: 0,
      daily_export_count: 0
    };

    let { error: insertError } = await supabase
      .from('user_accounts')
      .insert([secureUserRecord]);

    // Backward compatibility for old schemas:
    // - missing password_hash column
    // - password column is NOT NULL
    if (insertError && (isMissingPasswordHashColumnError(insertError) || isPasswordNotNullConstraintError(insertError))) {
      const legacyRecord = {
        ...secureUserRecord,
        password
      };
      if (isMissingPasswordHashColumnError(insertError)) {
        delete legacyRecord.password_hash;
      }
      const fallbackInsert = await supabase.from('user_accounts').insert([legacyRecord]);
      insertError = fallbackInsert.error;
    }

    if (insertError) {
      console.error('Error inserting new user:', insertError);
      if (insertError.code === '23505') {
        return { statusCode: 409, body: JSON.stringify({ success: false, message: 'This email is already registered.' }) };
      }
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Failed to create user.' }) };
    }

    if (invite_code) {
      try {
        const { data: invitation, error: inviteError } = await supabase
          .from('invitations')
          .select('*, agent_profiles!inner(*)')
          .eq('invite_code', invite_code)
          .eq('status', 'pending')
          .single();

        if (!inviteError && invitation) {
          const now = new Date();
          const expiresAt = new Date(invitation.expires_at);

          if (now < expiresAt) {
            await supabase.from('user_agent_relations').insert([
              {
                user_id: user.id,
                agent_id: invitation.agent_profiles.id,
                invite_code,
                registration_source: 'agent_invite'
              }
            ]);

            await supabase
              .from('invitations')
              .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
                invitee_email: email
              })
              .eq('id', invitation.id);
          }
        }
      } catch (relationError) {
        // Do not block successful registration because of relation write failures.
        console.error('Failed to process invite relation:', relationError);
      }
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: 'Trial account created successfully. Valid for 1 day.'
      })
    };
  } catch (err) {
    console.error('Handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Internal server error.' }) };
  }
};
