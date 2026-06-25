// Cross-platform Python venv setup. Robust to paths containing spaces (e.g. Google
// Drive) and to Windows cmd's mishandling of forward slashes — which broke the previous
// inline `&&` npm script. Creates python/.venv and installs server/python/requirements.txt.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const venvDir = path.join(root, 'python', '.venv');
const venvPython = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');
const requirements = path.join(root, 'server', 'python', 'requirements.txt');
const basePython = process.env.PYTHON || (isWin ? 'python' : 'python3');

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root });
  if (r.status !== 0) {
    console.error(`\nCommande échouée (code ${r.status ?? r.error?.message}).`);
    process.exit(r.status ?? 1);
  }
}

if (!fs.existsSync(venvPython)) {
  run(basePython, ['-m', 'venv', venvDir]);
} else {
  console.log('venv déjà présent — installation/maj des dépendances.');
}
run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', requirements]);
console.log('\nEnvironnement Python prêt :', venvPython);
