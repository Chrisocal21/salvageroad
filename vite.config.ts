import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 3000, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Split the big libraries into their own files so they download in parallel and cache between deploys.
        manualChunks(id) {
          if (id.includes('@dimforge/rapier3d-compat')) return 'rapier';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('cannon-es')) return 'cannon';
        },
      },
    },
  },
});
