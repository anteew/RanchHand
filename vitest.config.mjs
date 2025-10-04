import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: true,
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    reportsDirectory: './coverage',
    all: false,
    thresholds: {
      lines: 60,
      statements: 60,
      functions: 55,
      branches: 50,
    },
  },
});
