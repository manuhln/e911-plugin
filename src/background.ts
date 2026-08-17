import { app } from '@wazo/euc-plugins-sdk';
import type { WDASession } from '@wazo/euc-plugins-sdk/types';

import { createClient } from './api/client.ts';
import { MESSAGES, resolveLocale } from './locale/index.ts';

/**
 * Raise the "did you move" prompt without the user opening the tab.
 *
 * The backend decides staleness by comparing the caller's IP against the one
 * recorded when they last confirmed, and answers from its own records. This
 * makes no request to the emergency-services provider, which matters: they
 * permit only four concurrent connections across our entire account.
 *
 * This runs outside the visible tab, on the host's own schedule, so nothing
 * here may throw or leave an unhandled rejection -- a failure has no UI to
 * report to and must never disturb the host app. It also must not poll: one
 * check per session event is the contract, not a timer. And it must not
 * cache or re-derive staleness itself -- the backend deliberately does not
 * refresh `needs_confirmation`'s underlying IP on a read, so a read here
 * only ever reports what the backend already decided.
 */
async function check() {
  const apiUrl = import.meta.env.VITE_API_URL;
  // VITE_API_URL is inlined at build time. Unset means this build has no API
  // to call -- do nothing rather than request a relative (host-origin) URL.
  if (!apiUrl) return;

  try {
    const context = await app.getContext();
    const user = context.user as WDASession | undefined;
    if (!user?.token || !user?.host) return;

    const client = createClient({ token: user.token, host: user.host }, apiUrl);
    const result = await client.getMe();
    if (!result.ok) return;

    if (!result.data.needs_confirmation) {
      // The nudge from a previous check must not outlive the thing it was
      // nudging about, or the user learns to ignore a badge that never
      // clears (Finding 3). The in-tab confirm flow never touches this
      // badge, so this per-session check is the only place that can.
      try {
        app.updateBadge({ entityId: 'e911', badgeContent: null });
      } catch {
        // No badge support on this surface.
      }
      return;
    }

    const locale = resolveLocale(context.app?.locale);
    const title = MESSAGES[locale]['app.title'];
    const text = MESSAGES[locale]['status.movedTitle'];

    // Badge and notification are independent host capabilities that vary by
    // surface (desktop vs. mobile). Guard each on its own so a host missing
    // one still gets the other.
    try {
      app.updateBadge({ entityId: 'e911', badgeContent: '!' });
    } catch {
      // No badge support on this surface.
    }
    try {
      app.displayNotification(title, text);
    } catch {
      // No notification support on this surface.
    }
  } catch {
    // Swallow everything. This script has no UI to report to, and its only
    // job is an optional nudge -- never worth disturbing the host app over.
  }
}

(async () => {
  try {
    await app.initialize();
  } catch {
    // app.initialize() rejects if no host answers within its own 5s
    // timeout. There's no tab here to fall back to a boot-error screen
    // (see main.tsx) -- just stop.
    return;
  }
  app.onNewSession = () => { void check(); };
  void check();
})();
