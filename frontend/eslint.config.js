import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // public/monaco holds the copied, minified Monaco release (generated at build time)
  globalIgnores(['dist', 'public/monaco', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Warn, not error: these effects follow the standard "set loading, then fetch" /
      // "reset when opened" patterns. The rule targets React Compiler optimizations,
      // which this app does not use. Prefer the suggested patterns in new code.
      'react-hooks/set-state-in-effect': 'warn',
      // Only affects dev hot-reload of files that export both components and helpers.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Build tooling runs in Node, not the browser
    files: ['scripts/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Vitest runs with `globals: true` (vite.config.js)
    files: ['src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.vitest, ...globals.node },
    },
  },
])
