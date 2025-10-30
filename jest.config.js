export default {
  testEnvironment: 'jsdom',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],
  collectCoverageFrom: [
    'aemHelpers.js',
    'popup.js',
    '!node_modules/**',
    '!**/*.test.js'
  ],
  coverageThreshold: {
    './aemHelpers.js': {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
