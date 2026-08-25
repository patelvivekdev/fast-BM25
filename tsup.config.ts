import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/worker.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    esbuildOptions(options) {
      options.logOverride = {
        'empty-import-meta': 'silent',
      };
    },
  },
]);
