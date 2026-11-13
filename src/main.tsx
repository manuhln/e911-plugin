import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FormattedMessage, IntlProvider } from 'react-intl';
import { app } from '@wazo/euc-plugins-sdk';
import type { WDASession } from '@wazo/euc-plugins-sdk/types';

import App from './App.tsx';
import type { Session } from './api/types.ts';
import { DEFAULT_LOCALE, MESSAGES, resolveLocale } from './locale/index.ts';
import { applyTheme } from './theme.ts';
import { selectBootScreen } from './boot.ts';
import Message from './components/Message.tsx';
import './styles.css';

const PROMPT_VIEW = new URLSearchParams(window.location.search).get('view') === 'prompt';

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  // Shared by the initial mount and the retry button below, so a host that
  // only failed to answer in time gets a real second chance instead of a
  // dead end (Finding 4) -- this tab runs inside hosts where "reload the
  // page" usually isn't something the user can do. Only fetches; applying
  // the result to state is left to the caller, so the mount effect can still
  // gate it on `cancelled` below.
  async function bootstrap() {
    await app.initialize();
    const context = await app.getContext();
    const user = context.user as WDASession | undefined;
    return {
      locale: resolveLocale(context.app?.locale),
      theme: context.app?.theme,
      session: user?.token && user?.host ? { token: user.token, host: user.host } : null,
    };
  }

  useEffect(() => {
    // StrictMode runs this effect twice in development (mount, cleanup,
    // mount again). `cancelled` stops the first run's late state updates
    // from landing after its own cleanup fired, so two overlapping
    // initialize() calls don't fight over `session`/`ready`.
    let cancelled = false;

    (async () => {
      try {
        const result = await bootstrap();
        if (cancelled) return;
        setLocale(result.locale);
        applyTheme(result.theme);
        setSession(result.session);
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

  async function onRetry() {
    setReady(false);
    try {
      const result = await bootstrap();
      setLocale(result.locale);
      applyTheme(result.theme);
      setSession(result.session);
    } catch {
      // Same as the initial attempt: selectBootScreen surfaces this.
    } finally {
      setReady(true);
    }
  }

  const boot = selectBootScreen({ ready, session });

  return (
    <IntlProvider locale={locale} defaultLocale={DEFAULT_LOCALE} messages={MESSAGES[locale]}>
      {boot === 'ready' && session
        ? <App session={session} prompt={PROMPT_VIEW} />
        : (
          <main className="e911">
            {boot === 'error'
              ? (PROMPT_VIEW
                ? (
                  <section className="e911-card">
                    <p><FormattedMessage id="prompt.openTab" /></p>
                  </section>
                )
                : (
                  <section className="e911-card">
                    <Message messageKey="error.startup" severity="error" />
                    <div className="e911-actions">
                      <button type="button" onClick={() => void onRetry()}>
                        <FormattedMessage id="action.retry" />
                      </button>
                    </div>
                  </section>
                ))
              : <p>{MESSAGES[locale]['app.loading']}</p>}
          </main>
        )}
    </IntlProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
