import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/llms-route.ts', 'src/llms-full-route.ts', 'src/middleware.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  target: 'es2022',
  external: ['virtual:astro-agent-ready/config'],
});
