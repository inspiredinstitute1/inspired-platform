import test from 'node:test';
import assert from 'node:assert/strict';
import { bufferApiRequest } from '../lib/buffer-api-request.mjs';

test('API buffering preserves identity headers, method and body after consuming incoming stream', async () => {
  const incoming = new Request('https://local.test/api/admin/community', {
    method: 'POST', headers: { origin: 'https://local.test', 'oai-authenticated-user-id': 'synthetic' }, body: '{"action":"createGroup"}',
  });
  const buffered = await bufferApiRequest(incoming);
  assert(incoming.bodyUsed);
  assert.equal(buffered.method, 'POST');
  assert.equal(buffered.headers.get('oai-authenticated-user-id'), 'synthetic');
  assert.equal(buffered.headers.get('origin'), 'https://local.test');
  assert.equal(await buffered.text(), '{"action":"createGroup"}');
});

test('API buffering leaves bodyless and non-API requests untouched', async () => {
  for (const request of [new Request('https://local.test/api/progress'), new Request('https://local.test/callback', { method: 'POST', body: 'untouched' })]) {
    assert.equal(await bufferApiRequest(request), request);
    assert.equal(request.bodyUsed, false);
  }
});

test('API buffering rejects oversized declared bodies without reading them', async () => {
  const request = new Request('https://local.test/api/admin/community', { method: 'POST', headers: { 'content-length': '2000001' }, body: 'small actual body' });
  const result = await bufferApiRequest(request);
  assert.equal(result.status, 413);
  assert.match(result.headers.get('cache-control'), /no-store/);
});

test('API buffering enforces actual streamed bytes without trusting content-length', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2000001)); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://local.test/api/admin/finance-preview', { method: 'POST', body, duplex: 'half' });
  const result = await bufferApiRequest(request);
  assert.equal(result.status, 413);
  assert.equal(cancelled, true);
});

test('API buffering drains modest oversized bodies before returning the route limit error', async () => {
  const request = new Request('https://local.test/api/admin/finance-preview', { method: 'POST', body: 'x'.repeat(100001) });
  const result = await bufferApiRequest(request);
  assert.equal(result.status, 413);
  assert(request.bodyUsed);
});
