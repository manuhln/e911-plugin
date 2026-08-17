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

Vite inlines `VITE_*` variables into the bundle at **build** time, not at
runtime, so `.env` must be in place before `npm run build` runs. `.env` is
gitignored; it holds a value specific to each deployment.
