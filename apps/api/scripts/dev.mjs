import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(apiDirectory, '..');
const repoRoot = path.resolve(apiDirectory, '../../..');
const environment = { ...process.env };

if (process.platform === 'win32') {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(repoRoot, 'scripts', 'dev-with-windows-ca.ps1'),
    '-PrepareOnly',
  ], { cwd: repoRoot, encoding: 'utf8' });

  if (result.status !== 0 || result.error) {
    console.error(result.stderr || result.error?.message || 'Could not load trusted Windows certificates.');
    process.exit(1);
  }

  environment.NODE_EXTRA_CA_CERTS = result.stdout.trim().split(/\r?\n/).at(-1);
}

const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(process.execPath, [tsxCli, 'watch', 'src/index.ts'], {
  cwd: apiRoot,
  env: environment,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Could not start the API dev server: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
