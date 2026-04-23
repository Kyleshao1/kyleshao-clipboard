const crypto = require('node:crypto');
const { supabase } = require('./supabase');

function uuidFromString(value) {
  const hash = crypto.createHash('sha1').update(value).digest('hex');
  const parts = [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32)
  ];
  return parts.join('-');
}

async function getUserFromEvent(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data?.user) {
    return data.user;
  }

  const issuer = process.env.KYLEDEV_OAUTH_ISSUER;
  if (!issuer) return null;

  const resp = await fetch(`${issuer}/api/oauth-userinfo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return null;
  const profile = await resp.json();

  // Merge strategy:
  // - Prefer matching by email.
  // - Fallback to matching by user_metadata.username.
  // - If no match, create a Supabase auth user so owner_id stays a valid auth.users UUID.
  let matched = null;
  try {
    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = listData?.users || [];
    matched =
      users.find((u) => u.email && profile.email && u.email.toLowerCase() === String(profile.email).toLowerCase()) ||
      users.find((u) => u.user_metadata?.username && u.user_metadata.username === profile.username) ||
      null;
  } catch (_err) {
    matched = null;
  }

  if (!matched) {
    const password = crypto.randomBytes(16).toString('hex');
    const { data: created } = await supabase.auth.admin.createUser({
      email: profile.email,
      password,
      email_confirm: true,
      user_metadata: { username: profile.username }
    });
    matched = created?.user || null;
  }

  if (!matched) {
    // Last-resort: keep the request authenticated, but this UUID may not exist in auth.users.
    return {
      id: uuidFromString(`kydev:${profile.id}`),
      email: profile.email || '',
      user_metadata: { username: profile.username },
      app_metadata: { provider: 'kydev' }
    };
  }

  return matched;
}

module.exports = { getUserFromEvent };
