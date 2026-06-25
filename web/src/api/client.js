// Tiny fetch wrapper for the Lead Gen API. All paths are relative ('/api/...')
// and proxied by Vite to the server in dev.
const BASE = '/api';

async function request(method, path, body, opts = {}) {
  const headers = {};
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload, ...opts });
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); detail = j.error || detail; } catch { /* non-json */ }
    throw new Error(detail);
  }
  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
  // multipart upload
  upload: (p, formData) => request('POST', p, formData),
  // build a download URL (for export)
  url: (p) => `${BASE}${p}`,
};

export default api;
