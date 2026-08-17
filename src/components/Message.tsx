import { FormattedMessage } from 'react-intl';

import type { Severity } from '../screen.ts';

export default function Message({ messageKey, severity }: { messageKey: string; severity: Severity }) {
  return (
    <p
      className={'e911-message e911-message--' + severity}
      role={severity === 'error' ? 'alert' : 'status'}
    >
      <FormattedMessage id={messageKey} />
    </p>
  );
}
