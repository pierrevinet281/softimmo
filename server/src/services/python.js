// Bridge to Python workers. Spawns `python <worker>.py`, writes JSON to stdin,
// reads JSON from stdout. One short-lived process per call keeps it simple and
// crash-isolated. Used by the engine for search / extract / verify / phone.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import config from '../lib/config.js';
import logger from '../lib/logger.js';

let _checked = null;

// Resolve a working python executable: prefer the project venv, fall back to PATH.
export function resolvePython() {
  if (_checked) return _checked;
  const candidates = [
    config.pythonBin,
    path.join(config.root, 'python', '.venv', 'Scripts', 'python.exe'),
    path.join(config.root, 'python', '.venv', 'bin', 'python'),
    'python',
    'python3',
  ];
  for (const c of candidates) {
    if (c === 'python' || c === 'python3' || fs.existsSync(c)) { _checked = c; return c; }
  }
  _checked = 'python';
  return _checked;
}

/**
 * Run a worker. Returns parsed JSON (object). Rejects on timeout / bad exit / bad JSON.
 * @param {string} worker  filename without .py (e.g. 'search')
 * @param {object} input   JSON payload sent on stdin
 * @param {object} opts    { timeoutMs }
 */
export function runWorker(worker, input = {}, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const py = resolvePython();
  const script = path.join(config.pythonDir, `${worker}.py`);

  return new Promise((resolve, reject) => {
    const child = spawn(py, [script], { cwd: config.pythonDir });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`python worker '${worker}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`failed to start python ('${py}'): ${err.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stderr.trim()) logger.debug(`[py:${worker}] stderr:`, stderr.trim().slice(0, 500));
      if (!stdout.trim()) {
        return reject(new Error(`python worker '${worker}' produced no output (exit ${code}). ${stderr.slice(0, 300)}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && parsed.error) {
          return reject(new Error(`worker '${worker}' error: ${parsed.error}`));
        }
        resolve(parsed);
      } catch (e) {
        reject(new Error(`worker '${worker}' returned invalid JSON: ${e.message}. Raw: ${stdout.slice(0, 200)}`));
      }
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

// Quick health check used by /api/health and Settings.
export async function pythonHealth() {
  try {
    const r = await runWorker('phone', { phones: ['+14165550142'], default_region: 'CA' }, { timeoutMs: 20000 });
    return { ok: true, sample: r.results?.[0]?.e164 || null, python: resolvePython() };
  } catch (e) {
    return { ok: false, error: e.message, python: resolvePython() };
  }
}

export default runWorker;
