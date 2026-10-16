/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Two files on purpose: expo-router's test mocks require '/mock' from inside the
    // factory for the main entry, which must not resolve to the same module.
    '^react-native-reanimated$': '<rootDir>/jest/reanimated.js',
    '^react-native-reanimated/mock$': '<rootDir>/jest/reanimated-mock.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/engine/**/*.ts', 'src/data/**/*.ts', '!**/__tests__/**'],
  coverageThreshold: {
    './src/engine/scoring.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
};
