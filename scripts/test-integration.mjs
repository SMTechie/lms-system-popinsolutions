import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
const url = new URL(process.env.DATABASE_URL || '');
if (!url.pathname.endsWith('_test')) throw new Error('DATABASE_URL must name a disposable *_test database.');
const db = new PrismaClient();
await db.$executeRawUnsafe('TRUNCATE "User", "Setting", "AuditLog", "StoreOrder", "Document", "Supplier", "RateLimit", "ExternalIdentity", "OAuthState", "DataRecord" CASCADE');
await db.$disconnect();
const originals = ['tsconfig.json', 'next-env.d.ts'].map(file => [file, readFileSync(file, 'utf8')]);
const port = process.env.PORTAL_TEST_PORT || '3100';
const env = { ...process.env, NEXT_DIST_DIR: '.next/test', PORTAL_TEST_URL: `http://127.0.0.1:${port}` };
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', port], { env, stdio: 'inherit' });
let ready = false;
try {
  for (let n = 0; n < 120; n++) {
    try { if ((await fetch(`${env.PORTAL_TEST_URL}/api/health`)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Test server did not become ready.');
  const files = readdirSync('tests').filter(file => file.endsWith('.test.ts')).map(file => `tests/${file}`);
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...files], { env, stdio: 'inherit' });
  const code = await new Promise(resolve => child.on('exit', resolve));
  process.exitCode = code || 0;
} finally {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill('SIGTERM');
  for (const [file, contents] of originals) writeFileSync(file, contents);
}
