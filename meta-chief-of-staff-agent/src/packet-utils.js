'use strict';

const crypto = require('node:crypto');

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(stableJson(payload)).digest('hex');
}

function stableId(prefix, payload) {
  return `${prefix}_${hashPayload(payload).slice(0, 12)}`;
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter((item) => item !== null && typeof item !== 'undefined') : [value];
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function assertRequiredFields(object, fields, label) {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(object, field) || typeof object[field] === 'undefined') {
      throw new Error(`${label} missing required field: ${field}`);
    }
  }
  return object;
}

module.exports = { stableJson, hashPayload, stableId, normalizeArray, requireNonEmptyString, assertRequiredFields };
