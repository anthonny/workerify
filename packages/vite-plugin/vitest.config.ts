import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use node environment for testing Vite plugins
    environment: 'node',

    // Test file patterns
    include: ['src/**/*.{test,spec}.ts'],

    // Exclude certain patterns
    exclude: ['node_modules', 'dist', 'src/generated'],

    // Enable coverage reporting
    coverage: {
      enabled: false, // Disable by default, enable with --coverage flag
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/generated/',
        'scripts/'
      ]
    },

    // Global test configuration
    globals: true,

    // Setup files for test environment
    setupFiles: [],

    // Timeout for tests
    testTimeout: 10000,

    // TypeScript support
    typecheck: {
      tsconfig: './tsconfig.json'
    }
  },

  // ESM support
  esbuild: {
    target: 'es2022'
  }
});