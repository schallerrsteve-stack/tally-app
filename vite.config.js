import { defineConfig } from 'vite';
// Relative paths so the same build works in the Android app and at any web address (e.g. GitHub Pages /tally-app/)
export default defineConfig({ base: './' });
