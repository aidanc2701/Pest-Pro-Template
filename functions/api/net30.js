// Public, unauthenticated endpoint used ONLY by a client filling out a NET
// 30 credit application (?net30=<id>). Mirrors functions/api/proposal.js's
// design: given a specific proposal id, it can only ever merge a fixed
// whitelist of NET30-specific fields into that ONE record -- it never
// accepts or writes anything else (pricing, terms, signature, status),
// and it can't list, browse, or touch any other proposal.

const SUPABASE_URL = 'https://girqzwoadjovqeudypnw.supabase.co';
const ID_PATTERN = /^p[0-9]+-[a-z0-9]+$/;

const NET30_FIELDS = [
  'net30CompanyName', 'net30CompanyAddress', 'net30Email', 'net30Phone',
  'net30Dba', 'net30Website', 'net30DbNumber', 'net30OrgType', 'net30Fein',
  'net30YearsInBusiness', 'net30ApContactName', 'net30ApBillingAddress',
  'net30ApEmail', 'net30ApPhone', 'net30PaymentCycle', 'net30ApplicantName',
  'net30ApplicantTitle', 'net30SigLine', 'net30Date'
];

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

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'not configured' }, 500);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !body.fields || typeof body.fields !== 'object') {
    return json({ error: 'invalid body' }, 400);
  }
  const id = body.id;
  if (!ID_PATTERN.test(id)) return json({ error: 'invalid id' }, 400);

  const key = 'proposal-data:' + id;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: serviceHeaders(env) }
  );
  if (!res.ok) return json({ error: 'lookup failed' }, 502);
  const rows = await res.json();
  if (!rows.length) return json({ error: 'not found' }, 404);
  const state = JSON.parse(rows[0].value);

  if (state.net30SigLine && state.net30SigLine.trim()) {
    return json({ error: 'already signed' }, 409);
  }

  NET30_FIELDS.forEach(field => {
    if (field in body.fields) state[field] = body.fields[field];
  });

  const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
    method: 'POST',
    headers: { ...serviceHeaders(env), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value: JSON.stringify(state), updated_at: new Date().toISOString() })
  });
  if (!saveRes.ok) return json({ error: 'save failed' }, 502);

  return json({ ok: true });
}
