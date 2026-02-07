/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/unit', '<rootDir>/integration'],
    testMatch: ['**/*.test.ts'],
    collectCoverageFrom: [
        '../secure-chat-app/src/app/services/signal*.ts',
        '../secure-chat-app/src/app/services/crypto*.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
    setupFilesAfterEnv: ['<rootDir>/setup.ts'],
    moduleNameMapper: {
        '^idb-keyval$': '<rootDir>/mocks/idb-keyval.ts',
    },
};
