// ESLint (flat config) for the server. Formatting is left to Prettier.
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // k6 load scripts run in k6, not Node.
    files: ['scripts/load/**/*.js'],
    languageOptions: { globals: { __VU: 'readonly', __ITER: 'readonly', __ENV: 'readonly' } },
  },
  prettier,
];
