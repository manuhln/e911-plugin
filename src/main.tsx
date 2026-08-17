import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import { app } from '@wazo/euc-plugins-sdk';
import type { WDASession } from '@wazo/euc-plugins-sdk/types';

import App from './App.tsx';
import type { Session } from './api/types.ts';
import { DEFAULT_LOCALE, MESSAGES, resolveLocale } from './locale/index.ts';
import { applyTheme } from './theme.ts';
import './styles.css';

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await app.initialize();
        const context = await app.getContext();
        const user = context.user as WDASession | undefined;
        setLocale(resolveLocale(context.app?.locale));
        applyTheme(context.app?.theme);
        if (user?.token && user?.host) {
          setSession({ token: user.token, host: user.host });
        }
      } finally {
        // Outside the Wazo app there is no host to answer initialize(), so this
        // must still resolve or the page would hang on a blank screen.
        setReady(true);
      }
    })();
  }, []);

  return (
    <IntlProvider locale={locale} defaultLocale={DEFAULT_LOCALE} messages={MESSAGES[locale]}>
      {!ready || !session
        ? <main className="e911"><p>{MESSAGES[locale]['app.loading']}</p></main>
        : <App session={session} />}
    </IntlProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
