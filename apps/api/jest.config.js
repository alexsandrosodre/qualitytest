/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@qualitytest/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  // Metas de cobertura (medidas atuais: 84% stmts / 60% branches / 79% funcs
  // / 83% lines). Os limites ficam logo abaixo para barrar regressões sem
  // quebrar o build por variações pequenas.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 55,
      functions: 75,
      lines: 80,
    },
  },
  testEnvironment: 'node',
};
