// Shared DB helpers: id generation, JSON columns, dynamic update builders.
import { customAlphabet } from 'nanoid';

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export const newId = (prefix = '') => (prefix ? `${prefix}_${nano()}` : nano());
export const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export function parseJson(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}
export const toJson = (v) => (v == null ? null : JSON.stringify(v));

// Build a parameterized UPDATE SET clause from a plain object, skipping undefined.
export function buildUpdate(fields) {
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const set = keys.map((k) => `${k} = @${k}`).join(', ');
  const params = {};
  for (const k of keys) params[k] = fields[k];
  return { set, params, keys };
}
