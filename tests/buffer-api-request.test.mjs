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

test('API buffering rejects oversized declared bodies even with a smaller actual body', async () => {
  const request = new Request('https://local.test/api/admin/community', { method: 'POST', headers: { 'content-length': '2000001' }, body: 'small actual body' });
  const result = await bufferApiRequest(request);
  assert.equal(result.status, 413);
  assert.match(result.headers.get('cache-control'), /no-store/);
});

test('API buffering enforces actual streamed bytes without trusting content-length', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2000000+64*1024+1)); },
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

test('only PDF multipart uploads receive the bounded 6 MiB route allowance',async()=>{
 const upload=new Request('https://local.test/api/admin/files',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=synthetic'},body:new Uint8Array(2100000)});
 const accepted=await bufferApiRequest(upload);assert(accepted instanceof Request);assert.equal((await accepted.arrayBuffer()).byteLength,2100000);
 const json=new Request('https://local.test/api/admin/files',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(3001)});assert.equal((await bufferApiRequest(json)).status,413);
 const other=new Request('https://local.test/api/admin/community',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=synthetic'},body:new Uint8Array(2100000)});assert.equal((await bufferApiRequest(other)).status,413);
 const large=new Request('https://local.test/api/admin/files',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=synthetic','content-length':String(6*1024*1024+1)},body:'small'});assert.equal((await bufferApiRequest(large)).status,413);
});

test('small transport overflows are drained before 413 without forwarding a body',async()=>{
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2000001));controller.close();}});
 const request=new Request('https://local.test/api/progress',{method:'PUT',headers:{'content-length':'2000001'},body,duplex:'half'});
 const response=await bufferApiRequest(request);assert(response instanceof Response);assert.equal(response.status,413);assert(request.bodyUsed);
});
test('a misleading small-overflow length cannot bypass the absolute discard cap',async()=>{
 let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2000000+64*1024+1));},cancel(){cancelled=true;}});
 const request=new Request('https://local.test/api/progress',{method:'PUT',headers:{'content-length':'2000001'},body,duplex:'half'});
 assert.equal((await bufferApiRequest(request)).status,413);assert(cancelled);
});


test('ordinary full-paper imports pass the transport guard and oversized exam imports fail',async()=>{
 const body=JSON.stringify({action:'preview',questions:Array.from({length:250},()=>({question:'Choose the correct sentence. '.repeat(8),options:['A','B','C','D'],answer:2,explanation:'A meaningful explanation. '.repeat(10)}))});
 assert(body.length>3000);
 const request=new Request('https://local.test/api/admin/exams',{method:'POST',headers:{'content-type':'application/json'},body});
 const buffered=await bufferApiRequest(request);assert(buffered instanceof Request);assert.equal(await buffered.text(),body);
 const large=await bufferApiRequest(new Request('https://local.test/api/admin/exams',{method:'POST',body:'x'.repeat(1500001)}));assert.equal(large.status,413);
});
