module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-namespace': 'warn', // Allow namespaces (used in Express types)
    '@typescript-eslint/no-var-requires': 'warn', // Allow require() in some cases

    // General rules
    'no-console': 'off', // Allow console.log in backend
    'no-case-declarations': 'warn', // Allow declarations in case blocks
    'prefer-const': 'warn',
    'no-var': 'error',
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    '*.config.js',
    '*.config.ts',
  ],
};
