/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@qualitytest/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  coverageDirectory: './coverage',
  // Metas de cobertura (medidas atuais: 89% stmts / 70% branches / 85% funcs
  // / 90% lines). Os limites ficam logo abaixo para barrar regressões.
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 65,
      functions: 80,
      lines: 85,
    },
  },
  testEnvironment: 'node',
};
