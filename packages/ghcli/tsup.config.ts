import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['bin/ghcli.ts'],
    format: ['esm'],
    dts: false,
    clean: true,
    sourcemap: true,
    outDir: 'dist/bin',
  },
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
]);
