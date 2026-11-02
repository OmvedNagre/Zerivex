import { spawn, type ChildProcess } from 'node:child_process';

// Keep the queue consumer running whenever the local website is running.
const children: ChildProcess[] = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
for (const args of [
  ['node_modules/next/dist/bin/next', 'dev', ...process.argv.slice(2)],
  ['--import', 'tsx', 'scripts/worker.ts'],
]) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('error', () => { console.error('Local service could not start'); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
