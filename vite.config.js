import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'Xactus',
      formats: ['es', 'iife'],
      fileName: (format) => {
        if (format === 'es')   return 'xactus.esm.js';
        if (format === 'iife') return 'xactus.iife.js';
      },
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
    target: 'es2020',
    minify: false,
  },
});