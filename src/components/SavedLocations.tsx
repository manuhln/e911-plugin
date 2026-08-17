import { FormattedMessage } from 'react-intl';

import type { SavedLocation } from '../api/types.ts';

interface Props {
  locations: SavedLocation[];
  busy: boolean;
  onUse: (location: SavedLocation) => void;
  onRemove: (location: SavedLocation) => void;
}

export default function SavedLocations({ locations, busy, onUse, onRemove }: Props) {
  if (locations.length === 0) return null;

  return (
    <section className="e911-card">
      <h2><FormattedMessage id="saved.title" /></h2>
      <ul className="e911-saved">
        {locations.map((location) => (
          <li key={location.id}>
            <span className="e911-saved__label">{location.label}</span>
            <span className="e911-muted">
              {[location.address.house_number, location.address.street].filter(Boolean).join(' ')}
              {', '}{location.address.city}
            </span>
            <span className="e911-actions">
              <button type="button" disabled={busy} onClick={() => onUse(location)}>
                <FormattedMessage id="saved.use" />
              </button>
            </span>
            {/*
              Deliberately not grouped with "Use" above: this deletes a saved
              address, and on a phone a thumb slip beside the primary action
              is exactly how that happens. margin-left: auto (see styles.css)
              puts real distance between them.
            */}
            <button
              type="button"
              className="e911-saved__remove"
              disabled={busy}
              onClick={() => onRemove(location)}
            >
              <FormattedMessage id="saved.remove" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
