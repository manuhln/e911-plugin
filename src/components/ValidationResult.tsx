import { FormattedMessage } from 'react-intl';

import type { Civic, LocationResponse } from '../api/types.ts';

interface Props {
  data: LocationResponse;
  /** What the user typed, shown when the provider had no correction. */
  submitted: Civic;
  busy: boolean;
  onUse: (civic: Civic) => void;
  onEdit: () => void;
}

function AddressBlock({ civic }: { civic: Civic }) {
  return (
    <address className="e911-address">
      {[civic.house_number, civic.street].filter(Boolean).join(' ')}<br />
      {civic.suite ? <>{civic.suite}<br /></> : null}
      {civic.city}, {civic.state} {civic.postal_code}<br />
      {civic.country}
    </address>
  );
}

export default function ValidationResult({ data, submitted, busy, onUse, onEdit }: Props) {
  const corrected = data.corrected ?? null;
  const chosen = corrected ?? submitted;

  return (
    <section className="e911-card">
      <h2><FormattedMessage id="validated.title" /></h2>
      {corrected ? (
        <>
          <p><FormattedMessage id="validated.correctedIntro" /></p>
          <div className="e911-compare">
            <div>
              <p className="e911-compare-label"><FormattedMessage id="validated.providerEntry" /></p>
              <AddressBlock civic={corrected} />
            </div>
            <div>
              <p className="e911-compare-label"><FormattedMessage id="validated.yourEntry" /></p>
              <AddressBlock civic={submitted} />
            </div>
          </div>
        </>
      ) : (
        <AddressBlock civic={chosen} />
      )}
      <div className="e911-actions">
        <button type="button" disabled={busy} onClick={() => onUse(chosen)}>
          <FormattedMessage id={corrected ? 'validated.useCorrected' : 'validated.confirm'} />
        </button>
        <button type="button" disabled={busy} onClick={onEdit}>
          <FormattedMessage id="validated.edit" />
        </button>
      </div>
    </section>
  );
}
