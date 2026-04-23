const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function normalizePassword(password) {
  if (typeof password !== 'string') return '';
  return password.normalize('NFKC');
}

function hashPassword(password) {
  const normalized = normalizePassword(password);
  return bcrypt.hashSync(normalized, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  const normalized = normalizePassword(password);
  return bcrypt.compareSync(normalized, hash);
}

module.exports = { hashPassword, verifyPassword };

