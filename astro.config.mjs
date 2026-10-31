import { defineConfig } from 'astro/config';

export default defineConfig({
  server: { host: '127.0.0.1', port: 4173 },
  devToolbar: { enabled: false },
});
