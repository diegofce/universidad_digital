import './commands';
import { markApiRequestStarted, resetApiTiming } from './timing';

beforeEach(() => {
  resetApiTiming();
  cy.intercept({ url: '**/api/v1/**', middleware: true }, (request) => {
    markApiRequestStarted(request);
  });
});

// Cypress test isolation clears cookies, storage and page state between specs.
