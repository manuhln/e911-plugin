import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import type { AddressChoices, Choice, Civic } from '../api/types.ts';
import { keepRegion, regionsFor } from '../choices.ts';

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
  // A select holds the 2-letter code, which is what `country` means; the
  // `country-name` token is for a text input holding "Canada".
  country: 'country',
};

const REQUIRED: Array<keyof Civic> =
  ['house_number', 'street', 'city', 'state', 'postal_code', 'country'];

interface Props {
  initial: Civic | null;
  /** Absent on a backend that predates the dropdowns: fall back to typing. */
  choices: AddressChoices | null;
  busy: boolean;
  onCheck: (civic: Civic, label: string) => void;
  onCancel: (() => void) | null;
}

export default function AddressForm({ initial, choices, busy, onCheck, onCancel }: Props) {
  const intl = useIntl();
  const [civic, setCivic] = useState<Civic>({ ...EMPTY, ...(initial ?? {}) });
  const [label, setLabel] = useState('');

  const set = (key: keyof Civic) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCivic((current) => ({ ...current, [key]: event.target.value }));

  // Changing the country must not leave the old province behind -- see
  // keepRegion. Done here rather than in an effect so the two fields can never
  // be observed disagreeing, not even for one render.
  const setCountry = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setCivic((current) => ({
      ...current,
      country: event.target.value,
      state: keepRegion(choices, event.target.value, current.state),
    }));

  // Client-side only to avoid a pointless round trip. The backend is the
  // authority and rejects anything it cannot map -- notably a province name it
  // does not recognise, which it refuses rather than truncating.
  const incomplete = REQUIRED.some((key) => !civic[key].trim());

  const field = (key: keyof Civic, labelId: string, hintId?: string) => {
    const invalid = REQUIRED.includes(key) && !civic[key].trim();
    const hintElementId = hintId ? 'e911-hint-' + key : undefined;
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
          aria-describedby={hintElementId}
        />
        {hintId ? <span className="e911-hint" id={hintElementId}><FormattedMessage id={hintId} /></span> : null}
      </div>
    );
  };

  const select = (
    key: 'state' | 'country',
    labelId: string,
    options: Choice[],
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void,
  ) => (
    <div className="e911-field" key={key}>
      <label htmlFor={'e911-' + key}><FormattedMessage id={labelId} /></label>
      <select
        id={'e911-' + key}
        value={civic[key]}
        onChange={onChange}
        autoComplete={AUTOCOMPLETE[key]}
        required
        aria-invalid={!civic[key] || undefined}
        // Nothing to choose until a country is picked. Disabled rather than
        // empty so it reads as "not yet" instead of "broken".
        disabled={!options.length}
      >
        <option value="">{intl.formatMessage({ id: 'form.choose' })}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.name}</option>
        ))}
      </select>
    </div>
  );

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
      {/* Country first: it decides what the province list can contain. */}
      {choices
        ? select('country', 'form.country', choices.countries, setCountry)
        : field('country', 'form.country')}
      {choices
        ? select('state', 'form.state', regionsFor(choices, civic.country), set('state'))
        : field('state', 'form.state')}
      {field('postal_code', 'form.postalCode')}

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
