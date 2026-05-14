import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { fileURLToPath, URL } from 'node:url';

const PENUMBRA_DB = fileURLToPath(new URL('../../packages/db/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@penumbra/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@penumbra/providers': fileURLToPath(
        new URL('../../packages/providers/src/index.ts', import.meta.url),
      ),
      '@penumbra/types': fileURLToPath(
        new URL('../../packages/types/src/index.ts', import.meta.url),
      ),
      '@penumbra/db': PENUMBRA_DB,
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'better-sqlite3'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['better-sqlite3'],
  },
});
