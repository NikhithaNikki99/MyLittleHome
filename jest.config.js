module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/__tests__/helpers/setupJest.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
};
