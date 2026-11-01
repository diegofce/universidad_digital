import { defineConfig } from 'cypress';

export default defineConfig({
  reporter: 'spec',
  allowCypressEnv: false,
  expose: {
    apiUrl: (process.env.CYPRESS_API_URL ?? `${process.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/v1`).replace(/\/$/, ''),
    responseBudgetMs: Number(process.env.CYPRESS_RESPONSE_BUDGET_MS ?? 5000),
    teacherSearch: process.env.CYPRESS_TEACHER_SEARCH ?? 'an',
    allowDbWrites: process.env.CYPRESS_ALLOW_DB_WRITES === 'true',
  },
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    testIsolation: true,
    fixturesFolder: 'cypress/fixtures',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    video: false,
    screenshotOnRunFailure: true,
    retries: { runMode: 2, openMode: 0 },
    defaultCommandTimeout: 8000,
    requestTimeout: 10000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    setupNodeEvents(on, config) {
      config.env.adminEmail = process.env.CYPRESS_ADMIN_EMAIL;
      config.env.adminPassword = process.env.CYPRESS_ADMIN_PASSWORD;
      return config;
    },
  },
});
