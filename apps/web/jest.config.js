module.exports = {
  // Extend react-scripts Jest config
  ...require('react-scripts/config/jest/jest.config'),

  // Transform gapi-script and other ESM packages
  transformIgnorePatterns: [
    'node_modules/(?!(gapi-script)/)',
  ],

  // Ensure setup file is used
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
};
