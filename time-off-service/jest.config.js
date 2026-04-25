/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: './tsconfig.json',  // includes test/ folder — used by Jest only
    }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  coverageDirectory: './coverage',
  testMatch: ['**/test/**/*.spec.ts'],
  testTimeout: 30000,  // 30s for e2e tests with DB startup
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
