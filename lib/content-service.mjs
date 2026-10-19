import { roleFor } from './progress-service.mjs';

export const CONTENT_KINDS = ['division', 'course', 'subject', 'module', 'test_series', 'test'];
export const CONTENT_STATUSES = ['draft', 'review', 'published', 'paused', 'archived'];
const headers = { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const fields = 'id,kind,parent_id AS parentId,title,description,status,sort_order AS sortOrder,version,updated_at AS updatedAt';
const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);

export async function contentEndpoint(request, user, env) {
  if (!user?.userId || roleFor(user, env) !== 'Admin') return json({ error: 'Admin access required.' }, 403);
  if (!env.DB) return json({ error: 'Programme database unavailable.' }, 503);
  try {
    if (request.method === 'GET') {
      const nodes = await env.DB.prepare(`SELECT ${fields} FROM content_nodes ORDER BY sort_order,title,id`).all();
      const audit = await env.DB.prepare('SELECT id,node_id AS nodeId,actor_id AS actorId,reason,previous_json AS previousJson,next_json AS nextJson,changed_at AS changedAt FROM content_audit ORDER BY id DESC LIMIT 50').all();
      return json({ nodes: nodes.results || [], audit: audit.results || [] });
    }
    if (request.method !== 'POST') return json({ error: 'Use Archived status to retain programme records.' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
    const raw = await request.text();
    if (raw.length > 3000) return json({ error: 'Request too large.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid programme.' }, 400);
    const { kind, status, sortOrder, parentId = null } = body;
    if (!CONTENT_KINDS.includes(kind) || !CONTENT_STATUSES.includes(status) || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999 || (parentId !== null && !validId(parentId))) return json({ error: 'Invalid kind, status, parent or order.' }, 400);
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120 || typeof body.description !== 'string' || body.description.length > 1000 || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.length > 300) return json({ error: 'Provide a title, description and change reason (3–300 characters).' }, 400);
    const values = [parentId, body.title.trim(), body.description.trim(), status, sortOrder, user.userId, body.reason.trim(), Date.now()];
    if (body.id !== undefined) {
      if (!validId(body.id) || !Number.isSafeInteger(body.version) || body.version < 1) return json({ error: 'Invalid record or version.' }, 400);
      const existing = await env.DB.prepare('SELECT kind,version FROM content_nodes WHERE id=?').bind(body.id).first();
      if (!existing) return json({ error: 'Programme not found.' }, 404);
      if (existing.kind !== kind) return json({ error: 'Programme kind cannot change.' }, 400);
      const result = await env.DB.prepare('UPDATE content_nodes SET parent_id=?,title=?,description=?,status=?,sort_order=?,changed_by=?,change_reason=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(...values, body.id, body.version).run();
      if (!result.meta?.changes) return json({ error: 'A newer version exists. Reload before editing.' }, 409);
      return json({ id: body.id, version: body.version + 1 });
    }
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO content_nodes(id,kind,parent_id,title,description,status,sort_order,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, kind, ...values).run();
    return json({ id, version: 1 }, 201);
  } catch (error) {
    if (/Invalid programme hierarchy|Publish parent programmes first|Programme kind cannot change/.test(error.message)) return json({ error: error.message.includes('Publish parent') ? 'Publish parent programmes first.' : 'Choose a valid parent for this programme type.' }, 400);
    return json({ error: 'Programme manager unavailable. Your existing records are retained.' }, 503);
  }
}

export async function catalogueEndpoint(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!env.DB) return json({ error: 'Programme catalogue unavailable.' }, 503);
  try {
    // A paused/archived ancestor hides its entire branch without changing or
    // deleting descendants, learner records, enrolments or historical attempts.
    const { results = [] } = await env.DB.prepare(`WITH RECURSIVE visible AS (
      SELECT id,kind,parent_id,title,description,sort_order FROM content_nodes WHERE parent_id IS NULL AND kind='division' AND status='published'
      UNION ALL SELECT n.id,n.kind,n.parent_id,n.title,n.description,n.sort_order FROM content_nodes n JOIN visible p ON n.parent_id=p.id WHERE n.status='published'
    ) SELECT id,kind,parent_id AS parentId,title,description,sort_order AS sortOrder FROM visible ORDER BY sort_order,title,id`).all();
    return json({ programmes: results });
  } catch { return json({ error: 'Programme catalogue unavailable.' }, 503); }
}
