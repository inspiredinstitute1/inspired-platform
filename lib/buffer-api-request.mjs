// Workerd invalidates incoming streams after an early response. Give Vinext a
// bounded memory-backed API body so rejected writes cannot leave a live stream.
export async function bufferApiRequest(request) {
  const path = new URL(request.url).pathname;
  if (!request.body || !path.startsWith('/api/')) return request;
  const upload = path === '/api/admin/files' && request.method === 'POST' && request.headers.get('content-type')?.startsWith('multipart/form-data');
  const limit = upload ? 6*1024*1024 : ['/api/admin/content','/api/admin/finance-review'].includes(path) ? 8000
    : ['/api/admin/finance-preview','/api/admin/finance-imports','/api/admin/materials','/api/admin/faculty-notes','/api/faculty-notes'].includes(path) ? 100000
    : path.startsWith('/api/admin/') ? 3000 : 2000000;
  const transportLimit = upload ? 6*1024*1024 : 2000000;
  const tooLarge = () => new Response(JSON.stringify({ error: 'Request too large.' }), {
    status: 413, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  const declared = Number(request.headers.get('content-length'));
  if (declared > transportLimit) {
    cancel();
    return tooLarge();
  }
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > transportLimit) {
      cancel();
      return tooLarge();
    }
    // Drain modest rejected bodies before responding, while never buffering
    // more than the route's limit or reading beyond the global transport cap.
    if (size <= limit) chunks.push(value);
  }
  if (size > limit || declared > limit) return tooLarge();
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Request(request, { body: body.buffer });
}
