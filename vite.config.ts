import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode share` bundles everything into one HTML file that opens straight from disk.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'share' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'share' ? { outDir: 'share', chunkSizeWarningLimit: 4000 } : undefined,
}));
