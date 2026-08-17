/**
 * The SDK types `app.theme` as `Object | null` with no documented shape, so read
 * a few plausible keys defensively and otherwise keep our own defaults.
 * Inventing a richer structure would be inventing a contract.
 */
export function applyTheme(theme: unknown): void {
  if (!theme || typeof theme !== 'object') return;
  const source = theme as Record<string, any>;
  const pairs: Array<[string, unknown]> = [
    ['--e911-bg', source.background ?? source.backgroundColor],
    ['--e911-fg', source.color ?? source.textColor],
    ['--e911-accent', source.primaryColor ?? source.primary],
  ];
  for (const [name, value] of pairs) {
    if (typeof value === 'string' && value) {
      document.documentElement.style.setProperty(name, value);
    }
  }
}
