import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from './client.ts';
import type { Session } from './types.ts';

const SESSION: Session = { token: 'tok-abc', host: 'node10.voxsun.net' };

function stubFetch(status: number, body: unknown, capture?: { calls: any[] }) {
  return (async (url: any, init?: any) => {
    capture?.calls.push({ url: String(url), init });
    return { status, ok: status >= 200 && status < 300, json: async () => body } as any;
  }) as any;
}

test('getMe sends the session headers and no cookies', async () => {
  const capture = { calls: [] as any[] };
  const client = createClient(SESSION, 'https://intranet.test', stubFetch(200, {
    success: true, identity: { mode: 'did', label: '+15144704047' },
    needs_confirmation: false, address: null, status: null,
    last_synced: null, last_confirmed_at: null, saved_locations: [],
  }, capture));

  const result = await client.getMe();
  assert.equal(result.ok, true);
  const { url, init } = capture.calls[0];
  assert.equal(url, 'https://intranet.test/api/wazo/e911/me');
  assert.equal(init.headers['X-Auth-Token'], 'tok-abc');
  assert.equal(init.headers['X-Wazo-Host'], 'node10.voxsun.net');
  assert.equal(init.credentials, undefined);
});

test('a trailing slash on the base url does not double up', async () => {
  const capture = { calls: [] as any[] };
  const client = createClient(SESSION, 'https://intranet.test/', stubFetch(200, { success: true }, capture));
  await client.confirm();
  assert.equal(capture.calls[0].url, 'https://intranet.test/api/wazo/e911/me/confirm');
});

test('409 no_identity surfaces its reason', async () => {
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(409, { success: false, code: 409, reason: 'no_identity', message: 'nope' }));
  const result = await client.getMe();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 409);
  assert.equal(result.reason, 'no_identity');
});

test('409 blocked_by_mode is distinct from other 409s', async () => {
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(409, { success: false, code: 409, blocked_by_mode: true, mode: 'validate_only' }));
  const result = await client.submitLocation({ dry_run: false });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.blockedByMode, true);
  assert.equal(result.reason, undefined);
});

test('422 carries corrected, alternatives and civic_status through', async () => {
  const corrected = { name: '', house_number: '123', street: 'RUE SAINTE-CATHERINE',
                      suite: '', city: 'MONTREAL', state: 'QC',
                      postal_code: 'H3B1A1', country: 'CA' };
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(422, { success: false, code: 422, message: 'not in MSAG', corrected,
                     alternatives: [{ street: 'other' }],
                     civic_status: { msag_status: 'NOTFOUND' } }));
  const result = await client.submitLocation({ dry_run: true });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.corrected, corrected);
  assert.ok(result.alternatives);
  assert.equal(result.civicStatus?.msag_status, 'NOTFOUND');
});

test('400 from field normalisation carries field through', async () => {
  // Real shape: e911_api.py's _civic_from_payload rejects an unrecognized
  // state/country with `field`, never `missing`.
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(400, { success: false, code: 400, field: 'state',
                     message: "Unrecognized state/province: 'Nowhere'" }));
  const result = await client.submitLocation({});
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.field, 'state');
  assert.equal(result.missing, undefined);
});

test('400 from missing required fields carries missing through', async () => {
  // Real shape: agent.py's _e911_missing_fields rejects an incomplete
  // address with `missing`, never `field`.
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(400, { success: false, code: 400, missing: ['Street', 'City'],
                     message: 'Incomplete civic address: Street, City' }));
  const result = await client.submitLocation({});
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.missing, ['Street', 'City']);
  assert.equal(result.field, undefined);
});

test('unchanged carries its top-level status fields through, not nested', async () => {
  // _e911_apply_location's unchanged branch is the odd one out: routing_status,
  // msag_status and last_synced sit at the top level, not under civic_status.
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(200, {
      success: true, unchanged: true, did: '+15144704047', erl_id: 'erl-9',
      routing_status: 'ROUTABLE', msag_status: 'PASSED',
      last_synced: '2026-08-01T00:00:00',
      message: 'Address already provisioned; no change sent to Intrado.',
    }));
  const result = await client.submitLocation({ dry_run: false });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.unchanged, true);
  assert.equal(result.data.routing_status, 'ROUTABLE');
  assert.equal(result.data.msag_status, 'PASSED');
  assert.equal(result.data.last_synced, '2026-08-01T00:00:00');
});

test('a network failure becomes a result, not a rejection', async () => {
  const client = createClient(SESSION, 'https://intranet.test', (async () => {
    throw new TypeError('Failed to fetch');
  }) as any);
  const result = await client.getMe();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 0);
});

test('a non-JSON body does not throw', async () => {
  const client = createClient(SESSION, 'https://intranet.test', (async () => ({
    status: 502, ok: false, json: async () => { throw new SyntaxError('bad json'); },
  })) as any);
  const result = await client.getMe();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 502);
});

test('a 200 whose body is not success:true is still a failure', async () => {
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(200, { success: false, message: 'weird' }));
  const result = await client.getMe();
  assert.equal(result.ok, false);
});

test('submitLocation posts JSON', async () => {
  const capture = { calls: [] as any[] };
  const client = createClient(SESSION, 'https://intranet.test', stubFetch(200, { success: true }, capture));
  await client.submitLocation({ city: 'Montreal', dry_run: true });
  const { init } = capture.calls[0];
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { city: 'Montreal', dry_run: true });
});

test('deleteSavedLocation uses DELETE and puts the id in the path', async () => {
  const capture = { calls: [] as any[] };
  const client = createClient(SESSION, 'https://intranet.test', stubFetch(200, { success: true }, capture));
  await client.deleteSavedLocation(7);
  assert.equal(capture.calls[0].url, 'https://intranet.test/api/wazo/e911/me/locations/7');
  assert.equal(capture.calls[0].init.method, 'DELETE');
});

test('moved() POSTs to /me/moved with the auth headers', async () => {
  const capture = { calls: [] as any[] };
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(200, { success: true, status: 'detached' }, capture));
  const result = await client.moved();
  assert.equal(result.ok, true);
  const { url, init } = capture.calls[0];
  assert.equal(url, 'https://intranet.test/api/wazo/e911/me/moved');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-Auth-Token'], 'tok-abc');
  assert.equal(init.headers['X-Wazo-Host'], 'node10.voxsun.net');
});

test('a failed save that detached carries detached: true', async () => {
  const client = createClient(SESSION, 'https://intranet.test',
    stubFetch(502, { success: false, detached: true }));
  const result = await client.submitLocation({ dry_run: false });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.detached, true);
});
