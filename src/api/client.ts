import type {
  ApiFail, ApiResult, ConfirmResponse, LocationResponse, MeResponse,
  Session, SubmitPayload,
} from './types.ts';

const BASE_PATH = '/api/wazo/e911/me';

/**
 * The backend refuses in a dozen distinguishable ways and the UI phrases each
 * one differently, so every call resolves to a result object rather than
 * throwing. A thrown error would collapse "the provider rejected your address"
 * and "your session expired" into one catch block, and those need opposite
 * advice.
 */
export function createClient(session: Session, baseUrl: string, fetchImpl: typeof fetch = fetch) {
  const root = String(baseUrl || '').replace(/\/+$/, '');

  async function call<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await fetchImpl(root + BASE_PATH + path, {
        ...init,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          'X-Auth-Token': session.token,
          'X-Wazo-Host': session.host,
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } catch {
      // Offline, DNS failure, CORS rejection. status 0 means "never got there".
      return { ok: false, status: 0 };
    }

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.status >= 200 && response.status < 300 && body && body.success) {
      return { ok: true, data: body as T };
    }

    const fail: ApiFail = { ok: false, status: response.status };
    if (body) {
      if (body.reason) fail.reason = body.reason;
      if (body.blocked_by_mode) fail.blockedByMode = true;
      if (body.field) fail.field = body.field;
      if (Array.isArray(body.missing)) fail.missing = body.missing;
      if (body.corrected !== undefined) fail.corrected = body.corrected;
      if (body.alternatives !== undefined) fail.alternatives = body.alternatives;
      if (body.civic_status) fail.civicStatus = body.civic_status;
      if (body.message) fail.message = body.message;
    }
    return fail;
  }

  return {
    getMe: () => call<MeResponse>(''),
    submitLocation: (payload: SubmitPayload) =>
      call<LocationResponse>('/location', { method: 'POST', body: JSON.stringify(payload) }),
    confirm: () => call<ConfirmResponse>('/confirm', { method: 'POST' }),
    deleteSavedLocation: (id: number) =>
      call<{ success: true }>('/locations/' + encodeURIComponent(String(id)), { method: 'DELETE' }),
  };
}

export type E911Client = ReturnType<typeof createClient>;
