'use strict';

const SECRET_KEY_NORMALIZED = new Set([
  'apikey',
  'secret',
  'token',
  'oauth',
  'password',
  'credential',
  'credentials',
  'webhooksecret',
  'clientsecret',
  'accesstoken',
  'refreshtoken',
  'privatekey',
  'bearertoken',
  'jwt'
]);

function normalizeFieldName(field) {
  return String(field || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isServerSideSecretField(field) {
  return SECRET_KEY_NORMALIZED.has(normalizeFieldName(field));
}

function pathFor(parent, key) {
  if (!parent) return String(key);
  return `${parent}.${String(key)}`;
}

function findSecretFieldPaths(value, parentPath = '') {
  const paths = [];
  if (!value || typeof value !== 'object') return paths;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...findSecretFieldPaths(item, `${parentPath}[${index}]`));
    });
    return paths;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = pathFor(parentPath, key);
    if (isServerSideSecretField(key)) paths.push(childPath);
    paths.push(...findSecretFieldPaths(child, childPath));
  }
  return Array.from(new Set(paths));
}

function assertNoSecretFields(value, label = 'payload') {
  const paths = findSecretFieldPaths(value);
  if (paths.length) {
    throw new Error(`${label} contains server-side secret fields that must not be passed as arguments: ${paths.join(', ')}`);
  }
  return value;
}

module.exports = { SECRET_KEY_NORMALIZED, normalizeFieldName, isServerSideSecretField, findSecretFieldPaths, assertNoSecretFields };
