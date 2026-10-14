import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite-plugin-singlefile` incrusta JS, CSS y assets dentro de dist/index.html:
// el resultado es un único fichero que se abre con doble clic o desde un enlace.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    // Phaser ocupa ~1,2 MB minificado; es esperado en un build de un solo fichero.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
