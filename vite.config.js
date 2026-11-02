import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
// Relative paths so the same build works in the Android app and at any web address (e.g. GitHub Pages /tally-app/)
export default defineConfig({
  base: './',
  define: {
    __TALLY_VERSION__: JSON.stringify({
      version: pkg.version,
      build: process.env.TALLY_BUILD || 'dev',            // Android: GitHub build number (matches the build-N release)
      commit: (process.env.GITHUB_SHA || 'local').slice(0, 7),
      date: new Date().toISOString(),
    }),
  },
});
