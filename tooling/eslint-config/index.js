/**
 * @clubhub/eslint-config
 *
 * Shared ESLint configuration for all packages in the clubhub-platform monorepo.
 * Extends the root .eslintrc.base.js.
 *
 * Usage in a package:
 *   { "extends": ["@clubhub/eslint-config"] }
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
  ],
  rules: {
    // Constitutional: no-console replaces emit() in PRE scope
    'no-console': 'error',
    // Enforce explicit return types on public API
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    // No non-null assertions (constitutional safety)
    '@typescript-eslint/no-non-null-assertion': 'error',
    // No any
    '@typescript-eslint/no-explicit-any': 'error',
    // No floating promises
    '@typescript-eslint/no-floating-promises': 'error',
    // No unused vars
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
