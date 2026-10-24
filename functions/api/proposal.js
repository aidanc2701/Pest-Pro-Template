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

// The NET 30 credit application lives in the same record as the proposal
// but is filled in through a separate link (functions/api/net30.js). Keep
// this list in sync with NET30_FIELDS there. A proposal save carries a
// full copy of the form from whoever's browser sent it, which may be a
// stale one that loaded before the NET 30 was submitted -- so these fields
// are never taken from the request, only from what's already stored.
const NET30_FIELDS = [
  'net30CompanyName', 'net30CompanyAddress', 'net30Email', 'net30Phone',
  'net30Dba', 'net30Website', 'net30DbNumber', 'net30OrgType', 'net30Fein',
  'net30YearsInBusiness', 'net30ApContactName', 'net30ApBillingAddress',
  'net30ApEmail', 'net30ApPhone', 'net30PaymentCycle', 'net30ApplicantName',
  'net30ApplicantTitle', 'net30SigLine', 'net30Date'
];

async function fetchValue(env, key) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: serviceHeaders(env) }
  );
  if (!res.ok) throw new Error('lookup failed');
  const rows = await res.json();
  return rows.length ? rows[0].value : null;
}

// Non-empty NET 30 values from the standalone submission copy (preferred)
// or the stored proposal.
function net30Authority(stored, submission) {
  const out = {};
  NET30_FIELDS.forEach(f => {
    const v = (submission && submission[f]) || (stored && stored[f]);
    if (v) out[f] = v;
  });
  return out;
}

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
  let value = rows[0].value;
  // If the NET 30 was submitted, the standalone copy is the source of
  // truth for it -- even if some later save clobbered the proposal record.
  try {
    const subRaw = await fetchValue(env, 'net30-submission:' + id);
    if (subRaw) {
      const state = JSON.parse(value);
      Object.assign(state, net30Authority(state, JSON.parse(subRaw)));
      value = JSON.stringify(state);
    }
  } catch (err) { /* serve the record as stored */ }
  return json({ value });
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

  // Never let this request overwrite a NET 30 that's already been
  // submitted. Refuse to save at all (rather than guess) if we can't check.
  try {
    const [storedRaw, subRaw] = await Promise.all([
      fetchValue(env, 'proposal-data:' + id),
      fetchValue(env, 'net30-submission:' + id)
    ]);
    Object.assign(body.state, net30Authority(
      storedRaw ? JSON.parse(storedRaw) : {},
      subRaw ? JSON.parse(subRaw) : null
    ));
  } catch (err) {
    return json({ error: 'lookup failed' }, 502);
  }

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
