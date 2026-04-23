const crypto = require('node:crypto');
const { supabase } = require('./_lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const code = event.queryStringParameters?.code;
  if (!code) {
    return { statusCode: 400, body: 'Missing code' };
  }

  const issuer = process.env.KYLEDEV_OAUTH_ISSUER;
  const clientId = process.env.KYLEDEV_CLIENT_ID;
  const clientSecret = process.env.KYLEDEV_CLIENT_SECRET;
  const redirectUri = process.env.KYLEDEV_REDIRECT_URI;

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    return { statusCode: 400, body: 'Kydev OAuth not configured' };
  }

  const tokenResp = await fetch(`${issuer}/api/oauth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text().catch(() => '');
    return { statusCode: 400, body: `OAuth token failed: ${err}` };
  }

  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return { statusCode: 400, body: 'Missing access_token' };
  }

  let merged = false;
  try {
    const userResp = await fetch(`${issuer}/api/oauth-userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (userResp.ok) {
      const profile = await userResp.json();
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const users = listData?.users || [];
      const matched =
        users.find((u) => u.email && profile.email && u.email.toLowerCase() === String(profile.email).toLowerCase()) ||
        users.find((u) => u.user_metadata?.username && u.user_metadata.username === profile.username) ||
        null;

      if (matched) {
        merged = true;
      } else {
        const password = crypto.randomBytes(16).toString('hex');
        await supabase.auth.admin.createUser({
          email: profile.email,
          password,
          email_confirm: true,
          user_metadata: { username: profile.username }
        });
      }
    }
  } catch (_err) {
    merged = false;
  }

  const url = new URL(`https://${event.headers.host}/`);
  url.searchParams.set('token', accessToken);
  if (merged) url.searchParams.set('merge', '1');

  return {
    statusCode: 302,
    headers: { Location: url.toString() }
  };
};
