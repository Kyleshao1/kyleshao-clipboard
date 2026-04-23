const { supabase } = require('./_lib/supabase');
const { getUserFromEvent } = require('./_lib/auth');
const { verifyPassword } = require('./_lib/password');

const TABLE_NAME = 'cloud_clipboards';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const code = (event.queryStringParameters && event.queryStringParameters.code) || '';

    if (!code || code.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A valid code is required' })
      };
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('code,title,content,format,created_at,owner_id,password_hash')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Clipboard not found' })
      };
    }

    if (data.password_hash) {
      const user = await getUserFromEvent(event);
      const isOwner = Boolean(user && data.owner_id && user.id === data.owner_id);

      if (!isOwner) {
        const rawHeader =
          event.headers?.['x-clipboard-password'] ||
          event.headers?.['X-Clipboard-Password'] ||
          event.headers?.['x-clipboard-password'.toLowerCase()] ||
          '';
        const providedPassword = typeof rawHeader === 'string' ? rawHeader : '';

        const ok = providedPassword ? verifyPassword(providedPassword, data.password_hash) : false;
        if (!ok) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              code: data.code,
              title: data.title || '',
              format: data.format,
              created_at: data.created_at,
              passwordRequired: true,
              error: providedPassword ? 'Invalid password' : undefined
            })
          };
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        code: data.code,
        title: data.title || '',
        content: data.content,
        format: data.format,
        created_at: data.created_at,
        password_protected: Boolean(data.password_hash)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
