/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.tsx?$',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@qualitytest/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  coverageDirectory: './coverage',
  // Metas de cobertura (medidas atuais: 100% stmts / 87% branches / 100% funcs
  // / 100% lines no módulo de sessão). Cobre o núcleo de token seguro; os
  // limites barram regressões.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
  testEnvironment: 'node',
};
