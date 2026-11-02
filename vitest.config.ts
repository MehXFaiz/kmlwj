import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // The api/ suites all run against one shared Postgres database and several
    // of them mutate it (posting entries, and the dashboard's own code path
    // rebuilds the Account.currentBalance cache). Running files in parallel let
    // one file's writes land in the middle of another's assertions, surfacing
    // as phantom "balance drift" failures. Serial execution costs wall-clock
    // time but makes DB-backed results trustworthy.
    fileParallelism: false,
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'e2e/**'],
  }
})
