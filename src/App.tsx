import { useCallback, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { createClient, type E911Client } from './api/client.ts';
import type {
  ApiFail, ApiResult, Civic, LocationResponse, MeResponse, Session,
} from './api/types.ts';
import { messageKeyFor, selectScreen, severityFor } from './screen.ts';
import Message from './components/Message.tsx';
import AddressForm from './components/AddressForm.tsx';
import ValidationResult from './components/ValidationResult.tsx';

export default function App({ session }: { session: Session }) {
  const intl = useIntl();
  const [client] = useState<E911Client>(() =>
    createClient(session, import.meta.env.VITE_API_URL ?? ''));

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [fail, setFail] = useState<ApiFail | null>(null);
  const [editing, setEditing] = useState(false);
  const [validated, setValidated] = useState<ApiResult<LocationResponse> | null>(null);
  const [finished, setFinished] = useState<LocationResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<Civic | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await client.getMe();
    if (result.ok) { setMe(result.data); setFail(null); } else { setFail(result); }
    setLoading(false);
  }, [client]);

  useEffect(() => { void load(); }, [load]);

  const screen = selectScreen({
    loading, me, fail, editing, validated, finished: finished !== null,
  });

  // The provider's own spelling on a 422 rejection -- offered as a one-click
  // fill-in on the form, never auto-applied. `alternatives` stays unrendered:
  // its shape (dict for one, list for several) has never been observed from
  // this backend, so building UI against it would be a guess.
  const suggested = fail?.corrected ?? null;

  async function onStillHere() {
    setBusy(true);
    const result = await client.confirm();
    setBusy(false);
    if (result.ok) { await load(); return; }
    setFail(result);
  }

  async function onCheck(civic: Civic, label: string) {
    setBusy(true);
    setSubmitted(civic);
    setPendingLabel(label);
    const result = await client.submitLocation({ ...civic, label, dry_run: true });
    setBusy(false);
    if (result.ok) { setValidated(result); setFail(null); return; }
    setValidated(null);
    setFail(result);            // selectScreen keeps the user on the form
  }

  async function onCommit(civic: Civic) {
    setBusy(true);
    const result = await client.submitLocation({ ...civic, label: pendingLabel, dry_run: false });
    setBusy(false);
    if (result.ok) {
      setFinished(result.data);
      setValidated(null);
      setEditing(false);
      setFail(null);
      return;
    }
    setValidated(null);
    setFail(result);            // back to the form, banner explaining why
  }

  function onDone() {
    setFinished(null);
    setSubmitted(null);
    setPendingLabel('');
    setEditing(false);
    void load();
  }

  const addressLines = (civic: Civic) => (
    <address className="e911-address">
      {[civic.house_number, civic.street].filter(Boolean).join(' ')}<br />
      {civic.suite ? <>{civic.suite}<br /></> : null}
      {civic.city}, {civic.state} {civic.postal_code}<br />
      {civic.country}
    </address>
  );

  return (
    <main className="e911">
      <h1 className="e911-title"><FormattedMessage id="app.title" /></h1>

      {fail && screen !== 'no_identity' && screen !== 'unavailable' && (
        <Message messageKey={messageKeyFor(fail)} severity={severityFor(fail)} />
      )}

      {screen === 'loading' && <p><FormattedMessage id="app.loading" /></p>}

      {screen === 'unavailable' && (
        <Message
          messageKey={fail ? messageKeyFor(fail) : 'error.unknown'}
          severity={fail ? severityFor(fail) : 'error'}
        />
      )}

      {screen === 'no_identity' && (
        <section className="e911-card">
          <h2><FormattedMessage id="noIdentity.title" /></h2>
          <p><FormattedMessage id="noIdentity.body" /></p>
        </section>
      )}

      {screen === 'needs_confirmation' && (
        <section className="e911-card e911-card--warn">
          <h2><FormattedMessage id="status.movedTitle" /></h2>
          <p><FormattedMessage id="status.movedBody" /></p>
          {me?.address ? addressLines(me.address) : null}
          <div className="e911-actions">
            <button type="button" disabled={busy} onClick={() => void onStillHere()}>
              <FormattedMessage id="status.stillHere" />
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(true)}>
              <FormattedMessage id="status.iMoved" />
            </button>
          </div>
        </section>
      )}

      {screen === 'confirmed' && me?.address && (
        <section className="e911-card">
          <p className="e911-muted">
            <FormattedMessage id="app.forWhom" values={{ label: me.identity.label }} />
          </p>
          {addressLines(me.address)}
          <p><FormattedMessage id="status.confirmed" /></p>
          <p className="e911-muted">
            {me.last_confirmed_at
              ? intl.formatMessage({ id: 'app.lastConfirmed' }, {
                  date: intl.formatDate(me.last_confirmed_at, { dateStyle: 'medium' }) })
              : intl.formatMessage({ id: 'app.neverConfirmed' })}
          </p>
          <div className="e911-actions">
            <button type="button" onClick={() => setEditing(true)}>
              <FormattedMessage id="status.change" />
            </button>
          </div>
        </section>
      )}

      {screen === 'form' && (
        <>
          {suggested && (
            <section className="e911-card e911-card--warn">
              <h2><FormattedMessage id="form.suggestedTitle" /></h2>
              {addressLines(suggested)}
              <div className="e911-actions">
                <button type="button" onClick={() => { setSubmitted(suggested); setFail(null); }}>
                  <FormattedMessage id="validated.useCorrected" />
                </button>
              </div>
            </section>
          )}
          <AddressForm
            key={JSON.stringify(submitted ?? me?.address ?? null)}
            initial={submitted ?? me?.address ?? null}
            busy={busy}
            onCheck={onCheck}
            onCancel={me?.address ? () => { setEditing(false); setFail(null); } : null}
          />
        </>
      )}

      {screen === 'validated' && validated?.ok && submitted && (
        <ValidationResult
          data={validated.data}
          submitted={submitted}
          busy={busy}
          onUse={(civic) => void onCommit(civic)}
          onEdit={() => { setValidated(null); setEditing(true); }}
        />
      )}

      {screen === 'done' && finished && (
        <section className="e911-card">
          <h2><FormattedMessage id="done.title" /></h2>
          <p><FormattedMessage id={finished.unchanged ? 'done.unchanged' : 'done.body'} /></p>
          <div className="e911-actions">
            <button type="button" onClick={onDone}><FormattedMessage id="done.back" /></button>
          </div>
        </section>
      )}

      {/* Task 6 adds: saved addresses. */}
    </main>
  );
}
