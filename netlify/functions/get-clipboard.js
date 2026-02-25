const { supabase } = require('./_lib/supabase');

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
      .select('code,content,format,created_at')
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

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
