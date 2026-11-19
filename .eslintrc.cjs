/* Root ESLint config. UI text must go through t() (research R11), so bare JSX text is banned in app screens. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  settings: { react: { version: '18.3' } },
  env: { node: true, es2022: true, browser: true },
  ignorePatterns: ['node_modules/', '.next/', 'dist/', 'build/', 'coverage/', '.expo/', '*.config.js', '*.config.mjs', 'next-env.d.ts', 'playwright-report/', 'test-results/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'off'
  },
  overrides: [
    {
      files: ['apps/web/app/**/*.tsx', 'apps/mobile/app/**/*.tsx', 'apps/web/components/**/*.tsx', 'apps/mobile/src/**/*.tsx'],
      rules: { 'react/jsx-no-literals': ['error', { noStrings: false, allowedStrings: ['·', '—', '/', ':', '(', ')', '*', '|'] }] }
    }
  ]
};
