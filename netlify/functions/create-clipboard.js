const crypto = require('node:crypto');
const { supabase } = require('./_lib/supabase');
const { getUserFromEvent } = require('./_lib/auth');
const { hashPassword } = require('./_lib/password');

const TABLE_NAME = 'cloud_clipboards';
const CODE_LENGTH = 24;

function randomCode(length = CODE_LENGTH) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromEvent(event);
    const payload = JSON.parse(event.body || '{}');
    const { content, format } = payload;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const passwordEnabled = Boolean(payload.passwordEnabled);
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!content || typeof content !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'content is required' })
      };
    }

    if (title.length > 120) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'title is too long' })
      };
    }

    if (!['markdown', 'latex'].includes(format)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'format must be markdown or latex' })
      };
    }

    let passwordHash = null;
    if (passwordEnabled) {
      if (!password || password.length < 4 || password.length > 64) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'password must be 4-64 characters' })
        };
      }
      passwordHash = hashPassword(password);
    }

    let code = '';
    let inserted = null;

    for (let i = 0; i < 5; i += 1) {
      code = randomCode();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          code,
          title,
          content,
          format,
          password_hash: passwordHash,
          owner_id: user?.id || null
        })
        .select('code')
        .single();

      if (!error && data) {
        inserted = data;
        break;
      }

      if (!error || error.code !== '23505') {
        throw error;
      }
    }

    if (!inserted) {
      throw new Error('Failed to allocate unique clipboard code');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ code: inserted.code })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
