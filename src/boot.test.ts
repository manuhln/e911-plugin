import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectBootScreen } from './boot.ts';

const SESSION = { token: 't', host: 'h' };

test('not ready is always loading, regardless of session', () => {
  assert.equal(selectBootScreen({ ready: false, session: null }), 'loading');
  assert.equal(selectBootScreen({ ready: false, session: SESSION }), 'loading');
});

test('ready with a session is ready', () => {
  assert.equal(selectBootScreen({ ready: true, session: SESSION }), 'ready');
});

test('ready with no session is error, not stuck loading forever', () => {
  // Covers both a rejected app.initialize() (SDK timeout) and one that
  // resolved without ever handing back a usable session -- neither should
  // leave the user staring at loading text with no way forward.
  assert.equal(selectBootScreen({ ready: true, session: null }), 'error');
});
