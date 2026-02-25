const { supabase } = require('./_lib/supabase');
const { getUserFromEvent } = require('./_lib/auth');

const TABLE_NAME = 'cloud_clipboards';

exports.handler = async (event) => {
  if (event.httpMethod !== 'DELETE') {
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

    const code = (event.queryStringParameters && event.queryStringParameters.code) || '';
    if (!code || code.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A valid code is required' })
      };
    }

    const { data: current, error: queryError } = await supabase
      .from(TABLE_NAME)
      .select('code,owner_id')
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
        body: JSON.stringify({ error: 'Anonymous clipboard cannot be deleted' })
      };
    }

    if (current.owner_id !== user.id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' })
      };
    }

    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('code', code)
      .eq('owner_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
