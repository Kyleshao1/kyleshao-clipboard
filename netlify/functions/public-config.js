exports.handler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY' })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ supabaseUrl, supabasePublishableKey })
  };
};
