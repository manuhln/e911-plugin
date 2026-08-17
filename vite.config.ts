import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Two entries: the tab document, and the background script the Wazo app loads
// on its own to raise the "you seem to have moved" nudge.
export default defineConfig({
  plugins: [react()],
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
