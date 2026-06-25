// Small HTTP error helper + async route wrapper.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

// Wrap an async handler so thrown errors reach the error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorMiddleware(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('API error:', err);
  res.status(status).json({ error: err.message || 'Internal error', details: err.details });
}
