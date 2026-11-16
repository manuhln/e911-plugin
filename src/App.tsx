import { useCallback, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { app } from '@wazo/euc-plugins-sdk';

import { createClient, type E911Client } from './api/client.ts';
import type {
  ApiFail, ApiResult, Civic, LocationResponse, MeResponse, SavedLocation, Session, SubmitPayload,
} from './api/types.ts';
import { isAddressProvisioned, messageKeyFor, selectScreen, severityFor } from './screen.ts';
import Message from './components/Message.tsx';
import AddressForm from './components/AddressForm.tsx';
import ValidationResult from './components/ValidationResult.tsx';
import SavedLocations from './components/SavedLocations.tsx';

export default function App({ session, prompt = false }: { session: Session; prompt?: boolean }) {
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
  // Set when the pending check came from "Use" on a saved address, so
  // onCommit can send saved_location_id instead of expanded fields -- the
  // dry run and the commit must agree on what is being provisioned. Cleared
  // the moment the user checks a hand-edited address instead.
  const [savedInFlight, setSavedInFlight] = useState<number | null>(null);

  // `background` skips the loading screen: a refresh triggered by something
  // other than the initial mount (e.g. removing a saved address) must not
  // unmount whatever the user is currently looking at -- notably the address
  // form, which would otherwise wipe every field they'd typed (Finding 7).
  // `keepFail` leaves the current failure banner alone on a successful
  // reload: a failed action's error must outlive the refresh that follows it.
  const load = useCallback(async (background = false, keepFail = false) => {
    if (!background) setLoading(true);
    const result = await client.getMe();
    if (result.ok) { setMe(result.data); if (!keepFail) setFail(null); } else { setFail(result); }
    if (!background) setLoading(false);
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

  // In the modal, a finished action closes it; there is nothing else to do there.
  function closeIfPrompt() {
    if (!prompt) return;
    try { app.removeModal(); } catch { /* not in a modal */ }
  }

  // ponytail: SDK 0.0.19 has no "open tab" call. openLink just hands the URL
  // to the host; whether it routes in-app to our tab is untested.
  function openTab() {
    try { app.openLink('/custom/tab/general/e911'); } catch { /* no host */ }
    closeIfPrompt();
  }

  async function onStillHere() {
    setBusy(true);
    const result = await client.confirm();
    setBusy(false);
    if (result.ok) { await load(); closeIfPrompt(); return; }
    setFail(result);
  }

  async function onMoved() {
    setBusy(true);
    const result = await client.moved();
    setBusy(false);
    // Open the form whatever the answer: the user still needs to give their
    // new address, and the banner explains a failure. (A failure meaning we
    // can't serve the user at all -- 401/503/offline -- still wins and shows
    // the unavailable screen.) The reload keeps the failure so it stays visible.
    setFail(result.ok ? null : result);
    // The modal has no room for the form: it lands on the detached view,
    // which points the user to the tab.
    if (!prompt) setEditing(true);
    await load(true, true);
  }

  async function onCheck(civic: Civic, label: string) {
    setBusy(true);
    setSubmitted(civic);
    setPendingLabel(label);
    setSavedInFlight(null);     // hand-edited fields, not a saved shortcut
    const result = await client.submitLocation({ ...civic, label, dry_run: true });
    setBusy(false);
    if (result.ok) { setValidated(result); setFail(null); return; }
    setValidated(null);
    setFail(result);            // selectScreen keeps the user on the form
  }

  async function onCommit(civic: Civic) {
    setBusy(true);
    // Same source as the dry run that produced this screen: a saved id, or
    // the expanded fields. Never both, so the two steps can't disagree about
    // what is being provisioned.
    const payload: SubmitPayload = savedInFlight !== null
      ? { saved_location_id: savedInFlight, label: pendingLabel, dry_run: false }
      : { ...civic, label: pendingLabel, dry_run: false };
    const result = await client.submitLocation(payload);
    setBusy(false);
    if (result.ok) {
      setFinished(result.data);
      setValidated(null);
      setEditing(false);
      setFail(null);
      setSavedInFlight(null);
      return;
    }
    setValidated(null);
    setFail(result);            // back to the form, banner explaining why
    // A failed commit can still have changed what's provisioned server-side
    // (e.g. Intrado accepted the new location but attaching a subscriber to
    // it failed) -- reload so the screen reflects whatever the server now
    // holds instead of the address from before this attempt (Finding 5).
    await load(false, true);
  }

  async function onUseSaved(location: SavedLocation) {
    setBusy(true);
    setSubmitted(location.address);
    setSavedInFlight(location.id);
    // A label typed for a different (hand-edited) address must never tag
    // along onto a saved address picked afterwards -- onCommit would send it
    // as the label to save under, silently overwriting whatever saved entry
    // already has that name (Finding 2).
    setPendingLabel('');
    const result = await client.submitLocation({ saved_location_id: location.id, dry_run: true });
    setBusy(false);
    if (result.ok) { setValidated(result); setFail(null); return; }
    setValidated(null);
    setFail(result);
  }

  async function onRemoveSaved(location: SavedLocation) {
    setBusy(true);
    const result = await client.deleteSavedLocation(location.id);
    setBusy(false);
    // A saved address is only ever deleted, never edited in place, so a
    // success here can't change what's provisioned -- reload for the fresh
    // saved_locations list, not to refresh the live address. `background`
    // because this can happen while the address form is open and filled in
    // (Finding 7): the saved-locations list sits right above the form.
    if (result.ok) { await load(true); return; }
    setFail(result);
  }

  function onDone() {
    setFinished(null);
    setSubmitted(null);
    setPendingLabel('');
    setEditing(false);
    setSavedInFlight(null);
    void load();
    closeIfPrompt();
  }

  const addressLines = (civic: Civic) => (
    <address className="e911-address">
      {[civic.house_number, civic.street].filter(Boolean).join(' ')}<br />
      {civic.suite ? <>{civic.suite}<br /></> : null}
      {civic.city}, {civic.state} {civic.postal_code}<br />
      {civic.country}
    </address>
  );

  // The modal: the host draws it far shorter than requested, so only the
  // notification's title and the buttons. The address itself is entered in
  // the tab, where the user sees what they're registering.
  if (prompt) {
    const detached = screen === 'detached' || screen === 'form';   // form = no address at all
    return (
      <main className="e911 e911--prompt">
        {screen === 'loading' && <p><FormattedMessage id="app.loading" /></p>}
        {(screen === 'needs_confirmation' || detached) && (
          <h2><FormattedMessage id={detached ? 'detached.title' : 'status.movedTitle'} /></h2>
        )}
        {fail && <Message messageKey={messageKeyFor(fail)} severity={severityFor(fail)} />}
        {screen === 'needs_confirmation' && (
          <div className="e911-actions">
            <button type="button" disabled={busy} onClick={() => void onStillHere()}>
              <FormattedMessage id="status.stillHere" />
            </button>
            <button type="button" disabled={busy} onClick={() => void onMoved()}>
              <FormattedMessage id="status.iMoved" />
            </button>
          </div>
        )}
        {detached && (
          <div className="e911-actions">
            <button type="button" disabled={busy} onClick={openTab}>
              <FormattedMessage id="prompt.update" />
            </button>
          </div>
        )}
        {screen !== 'loading' && screen !== 'needs_confirmation' && !detached && !fail && (
          <p><FormattedMessage id="prompt.openTab" /></p>
        )}
      </main>
    );
  }

  return (
    <main className="e911">
      <h1 className="e911-title"><FormattedMessage id="app.title" /></h1>

      {fail && screen !== 'no_identity' && screen !== 'unavailable' && (
        <Message messageKey={messageKeyFor(fail)} severity={severityFor(fail)} />
      )}

      {screen === 'loading' && <p><FormattedMessage id="app.loading" /></p>}

      {screen === 'unavailable' && (
        <section className="e911-card">
          <Message
            messageKey={fail ? messageKeyFor(fail) : 'error.unknown'}
            severity={fail ? severityFor(fail) : 'error'}
          />
          {/* This tab runs inside desktop and mobile hosts, where "reload
              the app" (the copy above) usually isn't something the user can
              do -- and a flaky connection is exactly when they'd land here
              (Finding 4). */}
          <div className="e911-actions">
            <button type="button" onClick={() => void load()}>
              <FormattedMessage id="action.retry" />
            </button>
          </div>
        </section>
      )}

      {screen === 'no_identity' && (
        <section className="e911-card">
          <h2><FormattedMessage id="noIdentity.title" /></h2>
          <p><FormattedMessage id="noIdentity.body" /></p>
        </section>
      )}

      {(screen === 'needs_confirmation' || screen === 'form' || screen === 'detached') && !!me?.saved_locations.length && (
        <SavedLocations
          locations={me.saved_locations}
          busy={busy}
          onUse={(location) => void onUseSaved(location)}
          onRemove={(location) => void onRemoveSaved(location)}
        />
      )}

      {screen === 'needs_confirmation' && (
        <section className="e911-card e911-card--warn">
          <h2><FormattedMessage id="status.movedTitle" /></h2>
          <p><FormattedMessage id="status.movedBody" /></p>
          {me?.address ? addressLines(me.address) : null}
          {me && !isAddressProvisioned(me.status) && (
            <p><FormattedMessage id="status.notYetActive" /></p>
          )}
          <div className="e911-actions">
            <button type="button" disabled={busy} onClick={() => void onStillHere()}>
              <FormattedMessage id="status.stillHere" />
            </button>
            <button type="button" disabled={busy} onClick={() => void onMoved()}>
              <FormattedMessage id="status.iMoved" />
            </button>
          </div>
        </section>
      )}

      {screen === 'detached' && (
        <section className="e911-card e911-card--warn">
          <h2><FormattedMessage id="detached.title" /></h2>
          <p><FormattedMessage id="detached.body" /></p>
          <div className="e911-actions">
            <button type="button" disabled={busy} onClick={() => setEditing(true)}>
              <FormattedMessage id="detached.enter" />
            </button>
          </div>
          {me?.address && (
            <>
              {addressLines(me.address)}
              <div className="e911-actions">
                <button type="button" disabled={busy} onClick={() => void onStillHere()}>
                  <FormattedMessage id="detached.back" />
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {screen === 'confirmed' && me?.address && (
        <section className="e911-card">
          <p className="e911-muted">
            <FormattedMessage id="app.forWhom" values={{ label: me.identity.label }} />
          </p>
          {addressLines(me.address)}
          <p>
            <FormattedMessage
              id={isAddressProvisioned(me.status) ? 'status.confirmed' : 'status.notYetActive'}
            />
          </p>
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
            choices={me?.choices ?? null}
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

    </main>
  );
}
