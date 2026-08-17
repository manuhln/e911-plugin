import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import type { Civic } from '../api/types.ts';

const EMPTY: Civic = {
  name: '', house_number: '', street: '', suite: '',
  city: '', state: '', postal_code: '', country: '',
};

const AUTOCOMPLETE: Record<keyof Civic, string> = {
  name: 'name',
  house_number: 'address-line1',
  street: 'address-line2',
  suite: 'address-line3',
  city: 'address-level2',
  state: 'address-level1',
  postal_code: 'postal-code',
  country: 'country-name',
};

const REQUIRED: Array<keyof Civic> =
  ['house_number', 'street', 'city', 'state', 'postal_code', 'country'];

interface Props {
  initial: Civic | null;
  busy: boolean;
  onCheck: (civic: Civic, label: string) => void;
  onCancel: (() => void) | null;
}

export default function AddressForm({ initial, busy, onCheck, onCancel }: Props) {
  const intl = useIntl();
  const [civic, setCivic] = useState<Civic>({ ...EMPTY, ...(initial ?? {}) });
  const [label, setLabel] = useState('');

  const set = (key: keyof Civic) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setCivic((current) => ({ ...current, [key]: event.target.value }));

  // Client-side only to avoid a pointless round trip. The backend is the
  // authority and rejects anything it cannot map -- notably a province name it
  // does not recognise, which it refuses rather than truncating.
  const incomplete = REQUIRED.some((key) => !civic[key].trim());

  const field = (key: keyof Civic, labelId: string, hintId?: string) => {
    const invalid = REQUIRED.includes(key) && !civic[key].trim();
    return (
      <div className="e911-field" key={key}>
        <label htmlFor={'e911-' + key}><FormattedMessage id={labelId} /></label>
        <input
          id={'e911-' + key}
          value={civic[key]}
          onChange={set(key)}
          autoComplete={AUTOCOMPLETE[key]}
          required={REQUIRED.includes(key)}
          aria-invalid={invalid || undefined}
        />
        {hintId ? <span className="e911-hint"><FormattedMessage id={hintId} /></span> : null}
      </div>
    );
  };

  return (
    <form
      className="e911-card"
      onSubmit={(event) => { event.preventDefault(); onCheck(civic, label.trim()); }}
    >
      <h2><FormattedMessage id="form.title" /></h2>
      <p><FormattedMessage id="form.intro" /></p>

      {field('house_number', 'form.houseNumber')}
      {field('street', 'form.street')}
      {field('suite', 'form.suite', 'form.suiteHint')}
      {field('city', 'form.city')}
      {field('state', 'form.state')}
      {field('postal_code', 'form.postalCode')}
      {field('country', 'form.country')}

      <div className="e911-field">
        <label htmlFor="e911-label"><FormattedMessage id="form.saveAs" /></label>
        <input
          id="e911-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={intl.formatMessage({ id: 'form.saveAsPlaceholder' })}
        />
      </div>

      <div className="e911-actions">
        <button type="submit" disabled={busy || incomplete}>
          <FormattedMessage id="form.check" />
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={busy}>
            <FormattedMessage id="form.cancel" />
          </button>
        ) : null}
      </div>
    </form>
  );
}
