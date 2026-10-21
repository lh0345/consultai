import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.env')) throw new Error('Copy .env.example to .env before starting.');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
function run(args) {
  const child = spawn(npm, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  children.push(child);
  return child;
}
const compile = run(['exec', 'tsc', '--', '-p', 'server/tsconfig.json']);
compile.on('exit', (code) => {
  if (code) return process.exit(code);
  const api = spawn(process.execPath, ['--env-file=.env', 'server/dist/main.js'], { stdio: 'inherit' });
  children.push(api);
  run(['run', 'dev:web']);
  api.on('exit', (status) => { if (status) process.exit(status); });
});
process.on('SIGINT', () => { children.forEach((child) => child.kill()); process.exit(0); });
process.on('SIGTERM', () => { children.forEach((child) => child.kill()); process.exit(0); });
