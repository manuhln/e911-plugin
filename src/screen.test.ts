import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAddressProvisioned, messageKeyFor, selectScreen, severityFor } from './screen.ts';
import type { ApiFail } from './api/types.ts';

const base = {
  loading: false, me: null, fail: null,
  editing: false, validated: null, finished: false,
} as const;

const me = (over: Partial<any> = {}) => ({
  success: true as const,
  identity: { mode: 'did', label: '+15144704047' },
  needs_confirmation: false,
  address: { name: '', house_number: '1', street: 'A', suite: '', city: 'B',
             state: 'QC', postal_code: 'C', country: 'CA' },
  status: 'provisioned', last_synced: null, last_confirmed_at: null,
  saved_locations: [],
  ...over,
});

test('loading wins over everything', () => {
  assert.equal(selectScreen({ ...base, loading: true, me: me() }), 'loading');
});

test('401, 503 and offline are unavailable, never an empty form', () => {
  for (const status of [401, 503, 0]) {
    assert.equal(selectScreen({ ...base, fail: { ok: false, status } }), 'unavailable');
  }
});

test('no_identity gets its own terminal screen', () => {
  assert.equal(
    selectScreen({ ...base, fail: { ok: false, status: 409, reason: 'no_identity' } }),
    'no_identity');
});

test('a fresh user with no address goes straight to the form', () => {
  assert.equal(selectScreen({ ...base, me: me({ address: null }) }), 'form');
});

test('needs_confirmation shows the prompt, not the form', () => {
  assert.equal(selectScreen({ ...base, me: me({ needs_confirmation: true }) }), 'needs_confirmation');
});

test('an address on file with nothing pending is confirmed', () => {
  assert.equal(selectScreen({ ...base, me: me() }), 'confirmed');
});

test('editing overrides the confirmed view', () => {
  assert.equal(selectScreen({ ...base, me: me(), editing: true }), 'form');
});

test('a validation result outranks editing', () => {
  assert.equal(
    selectScreen({ ...base, me: me(), editing: true, validated: { ok: true, data: {} as any } }),
    'validated');
});

test('finished outranks everything except loading', () => {
  assert.equal(selectScreen({ ...base, me: me(), editing: true, finished: true }), 'done');
  assert.equal(selectScreen({ ...base, loading: true, finished: true }), 'loading');
});

test('a terminal failure reaches its screen even mid-edit, not swallowed into the form', () => {
  for (const status of [401, 503, 0]) {
    assert.equal(
      selectScreen({ ...base, me: me(), editing: true, fail: { ok: false, status } }),
      'unavailable');
  }
  assert.equal(
    selectScreen({
      ...base, me: me(), editing: true,
      fail: { ok: false, status: 409, reason: 'no_identity' },
    }),
    'no_identity');
});

test('409 no_address routes to the form, not a stale confirmed view', () => {
  assert.equal(
    selectScreen({ ...base, me: me(), fail: { ok: false, status: 409, reason: 'no_address' } }),
    'form');
  assert.equal(
    selectScreen({
      ...base, me: me(), editing: true,
      fail: { ok: false, status: 409, reason: 'no_address' },
    }),
    'form');
});

test('a submit failure keeps the user on the form rather than blanking the page', () => {
  assert.equal(
    selectScreen({ ...base, me: me(), editing: true, fail: { ok: false, status: 422 } }),
    'form');
});

test('no data and no failure is unavailable, not a form', () => {
  assert.equal(selectScreen({ ...base }), 'unavailable');
});

test('message keys are distinct per failure kind', () => {
  const key = (f: ApiFail) => messageKeyFor(f);
  assert.equal(key({ ok: false, status: 0 }), 'error.offline');
  assert.equal(key({ ok: false, status: 401 }), 'error.session');
  assert.equal(key({ ok: false, status: 503 }), 'error.unconfigured');
  assert.equal(key({ ok: false, status: 502 }), 'error.upstream');
  assert.equal(key({ ok: false, status: 404 }), 'error.notfound');
  assert.equal(key({ ok: false, status: 409, reason: 'no_identity' }), 'error.noIdentity');
  assert.equal(key({ ok: false, status: 409, reason: 'no_address' }), 'error.noAddress');
  assert.equal(key({ ok: false, status: 409, blockedByMode: true }), 'error.blockedByMode');
  assert.equal(key({ ok: false, status: 400, field: 'state' }), 'error.badField.state');
  assert.equal(key({ ok: false, status: 400, missing: ['street'] }), 'error.incomplete');
  assert.equal(key({ ok: false, status: 422, civicStatus: { msag_status: 'NOTFOUND' } }),
               'error.notInMsag');
  assert.equal(key({ ok: false, status: 422 }), 'error.rejected');
  assert.notEqual(key({ ok: false, status: 401 }), key({ ok: false, status: 503 }));
});

test('an unknown status still yields a key rather than undefined', () => {
  assert.equal(messageKeyFor({ ok: false, status: 418 }), 'error.unknown');
});

test('severity: an unapplied move is an error, a rejected form is a warning', () => {
  // A 502 means the previous address is still what dispatchers would receive.
  assert.equal(severityFor({ ok: false, status: 502 }), 'error');
  assert.equal(severityFor({ ok: false, status: 401 }), 'error');
  assert.equal(severityFor({ ok: false, status: 409, blockedByMode: true }), 'warning');
  assert.equal(severityFor({ ok: false, status: 400, missing: ['street'] }), 'warning');
  assert.equal(severityFor({ ok: false, status: 422 }), 'warning');
});

test('isAddressProvisioned is true only for a status of exactly "provisioned"', () => {
  assert.equal(isAddressProvisioned('provisioned'), true);
  assert.equal(isAddressProvisioned('validate_only'), false);
  assert.equal(isAddressProvisioned('error'), false);
  assert.equal(isAddressProvisioned(null), false);
});
