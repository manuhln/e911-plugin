# wazo-intrado-plugin

A Wazo EUC plugin that lets a phone-system user see and update the civic
address emergency services receive when they dial 911 (Intrado/ERS E911
provisioning), from a small React + TypeScript frontend.

## Development

```bash
npm install
npm run dev      # local dev server (Vite)
npm run build    # type-check with tsc, then bundle with vite -> dist/
npm test         # node --test over src/logic/*.test.ts and src/api/*.test.ts
```

`dist/` is what gets deployed and served at `e911-plugin.voxsun.net`. It
contains the built `app.html` / `app.js` (the UI) and `background.js` (the
Wazo plugin background script), at fixed filenames so the plugin manifest can
point at stable URLs.

## Configuration

Copy `.env.example` to `.env` and set:

- `VITE_API_URL` — base URL of the intranet E911 API, no trailing slash.

`.env` is gitignored; it holds a value specific to each deployment.

## Backend requirement

The intranet backend enforces `e911.plugin_origin`: it must match this
plugin's deployed origin (`https://e911-plugin.voxsun.net`) exactly, or every
request from this frontend returns `503`.
