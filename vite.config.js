import { defineConfig } from 'vite';

export default defineConfig({
  // Root directory for the project
  root: '.',

  // Public directory for static assets (PapaParse library)
  publicDir: 'lib',

  // Server configuration
  server: {
    port: 8080,
    host: '0.0.0.0',
    open: false,
    cors: true
  },

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  }
});
