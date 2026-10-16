/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/engine/**/*.ts', 'src/data/**/*.ts', '!**/__tests__/**'],
  coverageThreshold: {
    './src/engine/scoring.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
};
