// Tiny leveled logger — no dependency, structured-ish output.
const COLORS = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', debug: '\x1b[90m', ok: '\x1b[32m' };
const RESET = '\x1b[0m';

function emit(level, args) {
  const ts = new Date().toISOString();
  const color = COLORS[level] || '';
  // eslint-disable-next-line no-console
  console.log(`${color}[${ts}] ${level.toUpperCase()}${RESET}`, ...args);
}

export const logger = {
  info: (...a) => emit('info', a),
  warn: (...a) => emit('warn', a),
  error: (...a) => emit('error', a),
  debug: (...a) => (process.env.DEBUG ? emit('debug', a) : undefined),
  ok: (...a) => emit('ok', a),
};

export default logger;
