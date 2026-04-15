module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/server.ts',
    '!src/scripts/**',
  ],
  coverageThreshold: {
    global: {
      statements: 4.5, // Current: 4.91% - Baseline to prevent coverage regression
      branches: 1.5,   // Current: 1.68% - Will increase as more tests are added
      functions: 4,    // Current: 4.5% - Long-term target: 70%
      lines: 4.5,      // Current: 4.57% - Gradually raise with new tests
    },
    // Higher thresholds for critical security files (already well-tested)
    './src/services/jwtService.ts': {
      statements: 85,
      branches: 75,
      functions: 100,
      lines: 85,
    },
    './src/middleware/auth.ts': {
      statements: 95,
      branches: 85,
      functions: 100,
      lines: 95,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000,
  verbose: true,
};
