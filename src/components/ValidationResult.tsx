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

export default function ValidationResult({ data, submitted, busy, onUse, onEdit }: Props) {
  const corrected = data.corrected ?? null;
  const chosen = corrected ?? submitted;

  return (
    <section className="e911-card">
      <h2><FormattedMessage id="validated.title" /></h2>
      {corrected ? <p><FormattedMessage id="validated.correctedIntro" /></p> : null}
      <address className="e911-address">
        {[chosen.house_number, chosen.street].filter(Boolean).join(' ')}<br />
        {chosen.suite ? <>{chosen.suite}<br /></> : null}
        {chosen.city}, {chosen.state} {chosen.postal_code}<br />
        {chosen.country}
      </address>
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
