const { supabase } = require('./_lib/supabase');
const { getUserFromEvent } = require('./_lib/auth');

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

    if (!['markdown', 'latex'].includes(format)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'format must be markdown or latex' })
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
        body: JSON.stringify({ error: 'Anonymous clipboard cannot be edited' })
      };
    }

    if (current.owner_id !== user.id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' })
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({ content, format })
      .eq('code', code)
      .eq('owner_id', user.id)
      .select('code,format,created_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ item: updated })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
