// Public, unauthenticated endpoint used ONLY by a client opening a
// "Signing Link" (?view=<id>). It is the single narrow gap in an otherwise
// fully locked-down database: given a specific proposal id, it can read
// that one proposal (GET) or save a signature to it (POST). It cannot list
// proposals, touch anything else in the database, or be used to browse.
//
// This uses the Supabase SERVICE ROLE key (env.SUPABASE_SERVICE_ROLE_KEY),
// which bypasses Row Level Security entirely -- that's what makes it
// possible for a logged-out visitor to reach exactly one row. The service
// role key lives only in Cloudflare's environment variables, never in the
// page's own code, so it's never visible to anyone browsing the site.

const SUPABASE_URL = 'https://girqzwoadjovqeudypnw.supabase.co';
const ID_PATTERN = /^p[0-9]+-[a-z0-9]+$/;

function serviceHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'not configured' }, 500);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID_PATTERN.test(id)) return json({ error: 'invalid id' }, 400);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent('proposal-data:' + id)}&select=value`,
    { headers: serviceHeaders(env) }
  );
  if (!res.ok) return json({ error: 'lookup failed' }, 502);
  const rows = await res.json();
  if (!rows.length) return json({ error: 'not found' }, 404);
  return json({ value: rows[0].value });
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'not configured' }, 500);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !body.state || typeof body.state !== 'object') {
    return json({ error: 'invalid body' }, 400);
  }
  const id = body.id;
  if (!ID_PATTERN.test(id)) return json({ error: 'invalid id' }, 400);

  const idxRes = await fetch(
    `${SUPABASE_URL}/rest/v1/kv_store?key=eq.proposal-index&select=value`,
    { headers: serviceHeaders(env) }
  );
  if (!idxRes.ok) return json({ error: 'index lookup failed' }, 502);
  const idxRows = await idxRes.json();
  const index = idxRows.length ? JSON.parse(idxRows[0].value) : [];
  const item = index.find(i => i.id === id);
  if (!item) return json({ error: 'not found' }, 404);
  if (item.status === 'accepted') return json({ error: 'already signed' }, 409);

  const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
    method: 'POST',
    headers: { ...serviceHeaders(env), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'proposal-data:' + id, value: JSON.stringify(body.state), updated_at: new Date().toISOString() })
  });
  if (!saveRes.ok) return json({ error: 'save failed' }, 502);

  item.status = 'accepted';
  const idxSaveRes = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
    method: 'POST',
    headers: { ...serviceHeaders(env), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'proposal-index', value: JSON.stringify(index), updated_at: new Date().toISOString() })
  });
  if (!idxSaveRes.ok) return json({ error: 'status update failed' }, 502);

  return json({ ok: true });
}
