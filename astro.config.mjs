import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ashleynaoko.com',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4450 },
  vite: { server: { strictPort: true }, preview: { strictPort: true } },
});
