import type { AddressChoices, Choice } from './api/types.ts';

/** The provinces/states valid for one country. Empty when we can't say. */
export function regionsFor(
  choices: AddressChoices | null | undefined,
  country: string,
): Choice[] {
  return choices?.regions[country] ?? [];
}

/**
 * The state/province to keep after the country changes.
 *
 * Cleared unless the code is valid in the *new* country. Two codes make this
 * more than paranoia: "CA" is California inside the US list while also being
 * Canada's own country code, and QC is meaningless in the US. Carrying a stale
 * code across a country switch is how a Quebec address gets sent to Intrado as
 * a US one -- and ERS won't catch it, since it types the state as any two
 * characters.
 *
 * With no `choices` the form is rendering text inputs and there is nothing to
 * validate against, so whatever the user typed is left alone.
 */
export function keepRegion(
  choices: AddressChoices | null | undefined,
  country: string,
  state: string,
): string {
  if (!choices) return state;
  return regionsFor(choices, country).some((region) => region.code === state) ? state : '';
}
