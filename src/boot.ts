import type { Session } from './api/types.ts';

export type BootScreen = 'loading' | 'error' | 'ready';

/**
 * `app.initialize()` rejects after a 5s SDK-internal timeout if the host
 * never answers -- a slow host, a message-passing hiccup, or no host at all
 * (outside Wazo). It can also resolve without ever handing back a usable
 * session (e.g. a PortalSession with no token/host). Either way, "ready but
 * no session" must not render the same inert loading text forever: it needs
 * its own screen so the user has somewhere to go instead of a page that
 * never changes.
 */
export function selectBootScreen(state: { ready: boolean; session: Session | null }): BootScreen {
  if (!state.ready) return 'loading';
  return state.session ? 'ready' : 'error';
}
