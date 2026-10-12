import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {compendiumPlugin} from './build/site.mjs';

export default defineConfig(({mode}) => ({
  base: './',
  appType: 'mpa',
  plugins: [react(), compendiumPlugin({...loadEnv(mode, process.cwd(), 'TYPESENSE_'), ...process.env})],
  build: {
    outDir: 'dist',
    // Emit a real search.html so static hosts need no SPA fallback.
    rolldownOptions: {input: {home: 'index.html', search: 'search.html'}},
  },
}));
