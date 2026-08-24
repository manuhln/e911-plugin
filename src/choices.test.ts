import { test } from 'node:test';
import assert from 'node:assert/strict';

import { keepRegion, regionsFor } from './choices.ts';
import type { AddressChoices } from './api/types.ts';

// The real shape, trimmed. `regions.CA` is Canada; the "CA" *inside* the US
// list is California -- the collision this module exists to survive.
const CHOICES: AddressChoices = {
  countries: [{ code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' }],
  regions: {
    US: [{ code: 'CA', name: 'California' }, { code: 'NY', name: 'New York' }],
    CA: [{ code: 'ON', name: 'Ontario' }, { code: 'QC', name: 'Quebec' }],
  },
};

test('regionsFor returns the picked country\'s list', () => {
  assert.deepEqual(regionsFor(CHOICES, 'CA').map((r) => r.code), ['ON', 'QC']);
  assert.deepEqual(regionsFor(CHOICES, 'US').map((r) => r.code), ['CA', 'NY']);
});

test('regionsFor is empty before a country is picked, or for an unknown one', () => {
  assert.deepEqual(regionsFor(CHOICES, ''), []);
  assert.deepEqual(regionsFor(CHOICES, 'FR'), []);
  assert.deepEqual(regionsFor(null, 'CA'), []);
});

test('keepRegion keeps a province that is valid in the new country', () => {
  assert.equal(keepRegion(CHOICES, 'CA', 'QC'), 'QC');
  assert.equal(keepRegion(CHOICES, 'US', 'NY'), 'NY');
});

test('keepRegion clears a province the new country does not have', () => {
  // The bug this prevents: Quebec surviving a switch to the US would send
  // Intrado a US address in a province that doesn't exist there, and ERS
  // types the state as any two characters so it would be accepted.
  assert.equal(keepRegion(CHOICES, 'US', 'QC'), '');
  assert.equal(keepRegion(CHOICES, 'CA', 'NY'), '');
});

test('keepRegion does not confuse California with Canada', () => {
  // "CA" is a valid state code in the US list and a country code in
  // `countries`. Switching from the US to Canada must not keep California
  // just because the strings match.
  assert.equal(keepRegion(CHOICES, 'US', 'CA'), 'CA');   // California, still fine
  assert.equal(keepRegion(CHOICES, 'CA', 'CA'), '');     // Canada has no "CA"
});

test('keepRegion clears the province when the country is cleared', () => {
  assert.equal(keepRegion(CHOICES, '', 'QC'), '');
});

test('keepRegion leaves typed text alone when the backend sent no choices', () => {
  // Older voxnet: the form renders text inputs, so there is nothing to
  // validate against and wiping what the user typed would be a regression.
  assert.equal(keepRegion(null, 'US', 'Quebec'), 'Quebec');
  assert.equal(keepRegion(undefined, '', 'QC'), 'QC');
});
