# wazo-intrado-plugin

A Wazo EUC plugin that lets a phone-system user see and update the civic
address emergency services receive when they dial 911 (Intrado/ERS E911
provisioning), from a small React + TypeScript frontend.

## Development

```bash
npm install
npm run dev      # local dev server (Vite)
npm run build    # type-check with tsc, then bundle with vite -> dist/
npm test         # node --test over src/**/*.test.ts
```

## Configuration

Copy `.env.example` to `.env` and set:

- `VITE_API_URL` — base URL of the intranet E911 API, no trailing slash.
- `VITE_PLUGIN_URL` — the plugin's own public base URL, no trailing slash. The background script opens `app.html?view=prompt` from it in a modal when the user may have moved. Unset: no modal, badge and notification only.

**`VITE_API_URL` is inlined into the bundle at build time, not read at
runtime.** Vite substitutes it into `app.js` and `background.js` when
`npm run build` runs; there is no way to point an already-built `dist/` at a
different API afterwards. Each deployment target (staging, production, a
second tenant environment with its own intranet) needs its own `.env` and
its own `npm run build`. `.env` is gitignored — it holds a value specific to
each deployment.

## Deploying

`dist/` is a static site. Build it and serve its contents, unmodified, as
`https://e911-plugin.voxsun.net/` (or whatever origin you've provisioned —
the manifests below assume this one).

**The intranet's `e911.plugin_origin` setting must equal that origin
exactly.** The backend checks it on every request before doing anything
else; a mismatch — including a scheme, port, or trailing-slash difference —
makes every route answer `503`. This is the single most likely first-deploy
failure: if the tab loads but every call fails, check this first before
looking at tokens or CORS.

### Installing the plugin

A tenant admin installs this plugin in Wazo by manifest URL, one per
surface — French is picked up automatically, not installed separately:

| Surface           | Manifest URL | `id` |
|-------------------|--------------|------|
| Desktop / web app | `https://e911-plugin.voxsun.net/manifest.json` | `voxsun-e911-id` |
| Mobile            | `https://e911-plugin.voxsun.net/manifest-mobile.json` | `voxsun-e911-mobile-id` |

Each has a distinct `id` because installing both surfaces for one tenant
under the same `id` would collide. `manifest-fr.json` and
`manifest-mobile-fr.json` are not installed directly — they are
localization overlays (Teams-style, `name.short`/`name.full`/
`description.short`/`description.full`/`staticTabs[0].name` overrides only,
no `id` of their own) that each parent manifest's `localizationInfo.
additionalLanguages` points at for a French-locale host.

## What this does not do

- **No geolocation.** The address is entered by hand; the plugin never asks
  the browser or device for a physical position.
- **No address autocomplete.** No third-party address-lookup service is
  wired in.
- **No offline queue.** A submission made while offline simply fails; it is
  not queued for retry when connectivity returns.
- **The provider's `alternatives` payload is not yet rendered.** When
  Intrado's validation rejects an address with suggested corrections, the
  API result carries them, but the UI does not yet display them — wire it
  once a real 422 with that payload has been captured.
