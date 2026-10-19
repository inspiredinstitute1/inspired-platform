// Run only the built Worker locally, with disposable state and no real identity.
import './sites-env.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const config = resolve('dist/server/wrangler.json');
const binding = JSON.parse(readFileSync(config, 'utf8')).d1_databases?.find(x => x.binding === 'DB');
assert.equal(binding?.database_id, '00000000-0000-4000-8000-000000000000');
mkdirSync('.wrangler', { recursive: true });
const state = mkdtempSync(resolve('.wrangler/smoke-'));
const base = 'http://127.0.0.1:8793';
const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', config, '--local', '--persist-to', state, '--ip', '127.0.0.1', '--port', '8793', '--inspector-port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
try {
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(Error('Local Worker startup timed out')), 30000);
    const finish = fn => value => { clearTimeout(timeout); fn(value); };
    worker.once('error', finish(reject));
    worker.once('exit', finish(code => reject(Error(`Worker exited early: ${code}`))));
    const output = chunk => {
      logs += chunk.toString();
      if (logs.includes('Ready on ' + base)) finish(resolveReady)();
    };
    worker.stdout.on('data', output);
    worker.stderr.on('data', output);
  });
  const get = (path, options) => fetch(base + path, { signal: AbortSignal.timeout(10000), ...options });
  for (const path of ['/', '/portal.bundle.js', '/manifest.webmanifest', '/sw.js', '/offline.html']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
    console.log('PASS public runtime', path);
  }
  const legacy = await get('/index.html', { redirect: 'manual' });
  assert([301, 302, 307, 308].includes(legacy.status));
  assert.equal(new URL(legacy.headers.get('location'), base).pathname, '/');
  console.log('PASS legacy redirect');
  for (const path of ['/api/admin/social-links', '/api/admin/community', '/api/admin/learning', '/api/progress', '/api/admin/finance-preview']) {
    const response = await get(path, path.endsWith('finance-preview') ? {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ transactions: [] }),
    } : {});
    assert([401, 403].includes(response.status), `${path}: ${response.status}`);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    console.log('PASS anonymous API blocked and uncached', path);
  }
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  worker.kill('SIGTERM');
  const kill = setTimeout(() => worker.kill('SIGKILL'), 3000);
  kill.unref();
}
