import type { ApiFail, ApiResult, LocationResponse, MeResponse } from './api/types.ts';

export type Screen =
  | 'loading' | 'unavailable' | 'no_identity' | 'needs_confirmation'
  | 'confirmed' | 'form' | 'validated' | 'done';

export type Severity = 'error' | 'warning' | 'info';

export interface ScreenInput {
  loading: boolean;
  me: MeResponse | null;
  fail: ApiFail | null;
  editing: boolean;
  validated: ApiResult<LocationResponse> | null;
  finished: boolean;
}

/**
 * The single answer to "what is the user looking at".
 *
 * The ordering is deliberate: a failure meaning we cannot serve this user at
 * all outranks anything we might otherwise draw, because showing an empty
 * address form to an expired session invites someone to type their home
 * address into a page that will throw it away.
 */
export function selectScreen(state: ScreenInput): Screen {
  if (state.loading) return 'loading';
  if (state.finished) return 'done';

  const fail = state.fail;
  if (fail) {
    // no_address means nothing is on file to confirm; the form is where
    // that gets resolved, whether or not the user was already editing.
    if (fail.status === 409 && fail.reason === 'no_address') return 'form';

    // These are recoverable from the form itself: a rejected submission
    // (400/422) or provisioning switched off (409 blockedByMode). Every
    // other failure means we cannot serve this user at all, and that
    // outranks 'editing' too -- a session that expires or a backend that
    // goes unconfigured mid-edit must not be swallowed into a form that
    // can never submit.
    const recoverableFromForm =
      fail.status === 400 ||
      fail.status === 422 ||
      (fail.status === 409 && fail.blockedByMode);

    if (!recoverableFromForm) {
      if (fail.status === 409 && fail.reason === 'no_identity') return 'no_identity';
      if (fail.status === 401 || fail.status === 503 || fail.status === 0) return 'unavailable';
    }
  }

  if (state.validated) return 'validated';
  if (state.editing) return 'form';

  if (!state.me) return 'unavailable';
  if (state.me.address === null) return 'form';
  if (state.me.needs_confirmation) return 'needs_confirmation';
  return 'confirmed';
}

/** An i18n key. Backend prose is never shown to the user directly. */
export function messageKeyFor(fail: ApiFail): string {
  if (fail.status === 0) return 'error.offline';
  if (fail.status === 401) return 'error.session';
  if (fail.status === 503) return 'error.unconfigured';
  if (fail.status === 502) return 'error.upstream';
  if (fail.status === 404) return 'error.notfound';

  if (fail.status === 409) {
    if (fail.blockedByMode) return 'error.blockedByMode';
    if (fail.reason === 'no_identity') return 'error.noIdentity';
    if (fail.reason === 'no_address') return 'error.noAddress';
    return 'error.conflict';
  }

  if (fail.status === 400) {
    return fail.field ? 'error.badField.' + fail.field : 'error.incomplete';
  }

  if (fail.status === 422) {
    return (fail.civicStatus?.msag_status || '').toUpperCase() === 'NOTFOUND'
      ? 'error.notInMsag'
      : 'error.rejected';
  }

  return 'error.unknown';
}

export function severityFor(fail: ApiFail): Severity {
  if (fail.status === 400 || fail.status === 422) return 'warning';
  if (fail.status === 409 && fail.blockedByMode) return 'warning';
  return 'error';
}
