const { supabase } = require('./_lib/supabase');
const { getUserFromEvent } = require('./_lib/auth');
const { hashPassword } = require('./_lib/password');

const TABLE_NAME = 'cloud_clipboards';

exports.handler = async (event) => {
  if (event.httpMethod !== 'PATCH') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromEvent(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const { code, content, format } = payload;
    const title = typeof payload.title === 'string' ? payload.title.trim() : undefined;
    const passwordEnabled = typeof payload.passwordEnabled === 'boolean' ? payload.passwordEnabled : undefined;
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!code || typeof code !== 'string' || code.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A valid code is required' })
      };
    }

    if (!content || typeof content !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'content is required' })
      };
    }

    if (typeof title === 'string' && title.length > 120) {
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

    const { data: current, error: queryError } = await supabase
      .from(TABLE_NAME)
      .select('code,owner_id,password_hash')
      .eq('code', code)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }

    if (!current) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Clipboard not found' })
      };
    }

    if (!current.owner_id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Anonymous clipboard cannot be edited' })
      };
    }

    if (current.owner_id !== user.id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' })
      };
    }

    const updateFields = { content, format };
    if (typeof title === 'string') {
      updateFields.title = title;
    }

    if (passwordEnabled === true) {
      if (password) {
        if (password.length < 4 || password.length > 64) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'password must be 4-64 characters' })
          };
        }
        updateFields.password_hash = hashPassword(password);
      } else if (!current.password_hash) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'password is required to enable protection' })
        };
      }
    } else if (passwordEnabled === false) {
      updateFields.password_hash = null;
    }

    const { data: updated, error: updateError } = await supabase
      .from(TABLE_NAME)
      .update(updateFields)
      .eq('code', code)
      .eq('owner_id', user.id)
      .select('code,title,format,created_at,password_hash')
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        item: {
          code: updated.code,
          title: updated.title || '',
          format: updated.format,
          created_at: updated.created_at,
          password_protected: Boolean(updated.password_hash)
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
