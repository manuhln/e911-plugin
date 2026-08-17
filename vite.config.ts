import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Two entries: the tab document, and the background script the Wazo app loads
// on its own to raise the "you seem to have moved" nudge.
export default defineConfig({
  plugins: [react()],

  // Dev server settings that installing into Wazo actually requires.
  //
  // Installing the plugin means handing Wazo a manifest URL, which the Wazo web
  // UI then fetches from its own origin. Vite's dev CORS allows only localhost,
  // 127.0.0.1 and ::1 by default, so that fetch is refused with no
  // Access-Control-Allow-Origin and Wazo reports it as "cannot fetch manifest
  // content" -- which reads like the file is missing rather than blocked.
  //
  // strictPort matters more than it looks: without it, a stale dev server still
  // holding 5173 silently pushes the new one to 5174, and the URL pasted into
  // Wazo then points at nothing.
  //
  // Note the browser will still refuse an http:// manifest served to an https://
  // Wazo page as mixed content, unless the host is localhost/127.0.0.1, which
  // browsers exempt. Run the dev server on the same machine as the browser.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: {
      origin: [
        /\.voxsun\.net$/,
        /\.wazo\.io$/,
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      ],
    },
  },

  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'app.html'),
        background: path.resolve(__dirname, 'src/background.ts'),
      },
      output: { entryFileNames: () => '[name].js' },
    },
  },
});
