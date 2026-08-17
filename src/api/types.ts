export interface Civic {
  name: string;
  house_number: string;
  street: string;
  suite: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface SavedLocation {
  id: number;
  label: string;
  address: Civic;
}

export interface CivicStatus {
  routing_status?: string | null;
  msag_status?: string | null;
  position_status?: string | null;
}

export interface MeResponse {
  success: true;
  identity: { mode: string; label: string };
  needs_confirmation: boolean;
  address: Civic | null;
  status: string | null;
  last_synced: string | null;
  last_confirmed_at: string | null;
  saved_locations: SavedLocation[];
}

export interface LocationResponse {
  success: true;
  dry_run?: boolean;
  unchanged?: boolean;
  did?: string;
  erl_id?: string;
  civic_status?: CivicStatus;
  corrected?: Civic | null;
  message?: string;
  /** Per-subscriber attach detail on a full provision; plural sibling of `message`. */
  messages?: string[];
  /**
   * The `unchanged: true` branch is the odd one out: `_e911_apply_location`
   * puts these at the top level there instead of nesting them under
   * `civic_status` like every other branch. Do not "tidy" them into
   * `civic_status` -- that's not what the backend sends on this branch.
   */
  routing_status?: string | null;
  msag_status?: string | null;
  last_synced?: string | null;
}

export interface ConfirmResponse {
  success: true;
  confirmed_at: string;
  message?: string;
}

/** Everything the backend can say when it refuses. */
export interface ApiFail {
  ok: false;
  status: number;
  reason?: string;
  blockedByMode?: boolean;
  field?: string;
  missing?: string[];
  corrected?: Civic | null;
  alternatives?: unknown;
  civicStatus?: CivicStatus;
  /** Backend prose. Diagnostics only -- the UI shows a translated key instead. */
  message?: string;
}

export type ApiResult<T> = { ok: true; data: T } | ApiFail;

export interface Session {
  token: string;
  host: string;
}

export interface SubmitPayload extends Partial<Civic> {
  dry_run?: boolean;
  label?: string;
  saved_location_id?: number | null;
}
