const { supabase } = require('./_lib/supabase');
const { getUserFromEvent } = require('./_lib/auth');

const TABLE_NAME = 'cloud_clipboards';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
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

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('code,title,format,created_at,password_hash')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        items: (data || []).map((item) => ({
          code: item.code,
          title: item.title || '',
          format: item.format,
          created_at: item.created_at,
          password_protected: Boolean(item.password_hash)
        }))
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
