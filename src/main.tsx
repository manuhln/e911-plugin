import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { app } from '@wazo/euc-plugins-sdk';
import type { WDASession } from '@wazo/euc-plugins-sdk/types';

import App from './App.tsx';
import type { Session } from './api/types.ts';
import { DEFAULT_LOCALE, MESSAGES, resolveLocale } from './locale/index.ts';
import { applyTheme } from './theme.ts';
import { selectBootScreen } from './boot.ts';
import Message from './components/Message.tsx';
import './styles.css';

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // StrictMode runs this effect twice in development (mount, cleanup,
    // mount again). `cancelled` stops the first run's late state updates
    // from landing after its own cleanup fired, so two overlapping
    // initialize() calls don't fight over `session`/`ready`.
    let cancelled = false;

    (async () => {
      try {
        await app.initialize();
        const context = await app.getContext();
        if (cancelled) return;
        const user = context.user as WDASession | undefined;
        setLocale(resolveLocale(context.app?.locale));
        applyTheme(context.app?.theme);
        if (user?.token && user?.host) {
          setSession({ token: user.token, host: user.host });
        }
      } catch {
        // app.initialize() rejects if the host never answers within its own
        // 5s timeout (slow host, message-passing hiccup, or no host at all
        // outside Wazo). `selectBootScreen` below is what actually surfaces
        // this to the user; catching here only stops it becoming an
        // unhandled promise rejection in the console.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const boot = selectBootScreen({ ready, session });

  return (
    <IntlProvider locale={locale} defaultLocale={DEFAULT_LOCALE} messages={MESSAGES[locale]}>
      {boot === 'ready' && session
        ? <App session={session} />
        : (
          <main className="e911">
            {boot === 'error'
              ? <Message messageKey="error.startup" severity="error" />
              : <p>{MESSAGES[locale]['app.loading']}</p>}
          </main>
        )}
    </IntlProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
