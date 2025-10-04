export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // ES2020+ globals
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Fetch API (Node.js 18+)
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: {
      // Possible Problems
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-undef': 'error',
      'no-constant-condition': 'warn',
      
      // Suggestions
      'no-console': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      
      // Layout & Formatting
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'arrow-spacing': 'error',
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
    },
  },
  // Allow console in CLI scripts
  {
    files: ['cli.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];
