import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { messageKeyFor } from '../screen.ts';
import type { ApiFail } from '../api/types.ts';

// The backend's `field` is a finite set of exactly two values -- the loop at
// vx_intranet/e911_api.py:295-296 in the voxnet repo. messageKeyFor builds
// 'error.badField.' + field dynamically, so nothing statically names these
// keys; a missing translation would render the raw id on screen instead of
// failing a build.
const BAD_FIELDS = ['state', 'country'] as const;

// One representative ApiFail per branch of messageKeyFor. The required key
// list is derived by calling the real function, not by retyping its output,
// so a change to screen.ts's branching is what drives this list, not a
// second hand-maintained copy of it.
const SAMPLE_FAILS: ApiFail[] = [
  { ok: false, status: 0 },
  { ok: false, status: 401 },
  { ok: false, status: 503 },
  { ok: false, status: 502 },
  { ok: false, status: 404 },
  { ok: false, status: 409, blockedByMode: true },
  { ok: false, status: 409, reason: 'no_identity' },
  { ok: false, status: 409, reason: 'no_address' },
  { ok: false, status: 409 },
  { ok: false, status: 400 },
  ...BAD_FIELDS.map((field) => ({ ok: false, status: 400, field }) as ApiFail),
  { ok: false, status: 422, civicStatus: { msag_status: 'NOTFOUND' } },
  { ok: false, status: 422 },
  { ok: false, status: 418 }, // anything unmapped
];

export const REQUIRED_MESSAGE_KEYS = Array.from(new Set(SAMPLE_FAILS.map(messageKeyFor)));

function loadLocale(path: URL): Record<string, string> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const en = loadLocale(new URL('./en.json', import.meta.url));
const fr = loadLocale(new URL('./fr.json', import.meta.url));

test('messageKeyFor produces exactly the 15 known keys', () => {
  assert.equal(REQUIRED_MESSAGE_KEYS.length, 15);
});

test('every messageKeyFor key exists in en.json', () => {
  for (const key of REQUIRED_MESSAGE_KEYS) {
    assert.ok(key in en, 'en.json is missing ' + key);
  }
});

test('every messageKeyFor key exists in fr.json', () => {
  for (const key of REQUIRED_MESSAGE_KEYS) {
    assert.ok(key in fr, 'fr.json is missing ' + key);
  }
});

test('en.json and fr.json declare the identical set of keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
});

test('no French value is byte-identical to its English counterpart', () => {
  for (const key of Object.keys(en)) {
    assert.notEqual(fr[key], en[key], 'fr.json key "' + key + '" looks untranslated');
  }
});
