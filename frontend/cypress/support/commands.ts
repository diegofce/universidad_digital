import type { Interception } from 'cypress/types/net-stubbing';
import { apiDurationMs, markApiRequestStarted } from './timing';

declare global {
  namespace Cypress { // eslint-disable-line @typescript-eslint/no-namespace
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
      assertApiResponse(alias: `@${string}`, expectedStatus: number): Chainable<Interception>;
    }
  }
}

Cypress.Commands.add('loginAsAdmin', () => {
  cy.env(['adminEmail', 'adminPassword']).then(({ adminEmail, adminPassword }) => {
    const email = adminEmail as string | undefined;
    expect(Boolean(email?.trim()), 'CYPRESS_ADMIN_EMAIL está configurado').to.equal(true);
    expect(Boolean(adminPassword), 'CYPRESS_ADMIN_PASSWORD está configurado').to.equal(true);

    cy.session([email], () => {
      cy.visit('/login');
      cy.intercept('POST', '**/api/v1/auth/login', (request) => {
        markApiRequestStarted(request);
        request.continue();
      }).as('adminLogin');
      cy.get('input[autocomplete="username"]').type(email!);
      cy.get('input[autocomplete="current-password"]').type(adminPassword, { log: false });
      cy.contains('button', 'Iniciar sesión').click();
      cy.wait('@adminLogin').then(({ request, response }) => {
        expect(response?.statusCode).to.eq(200);
        expect(request.body.email).to.eq(email);
        expect(typeof request.body.password).to.eq('string');
        expect(response?.body).to.include({ email });
        const duration = apiDurationMs(request);
        expect(duration).to.be.a('number').and.lessThan(Number(Cypress.expose('responseBudgetMs')));
      });
      cy.location('pathname').should('eq', '/dashboard');
    }, {
      cacheAcrossSpecs: false,
      validate: () => {
        cy.request({
          url: `${Cypress.expose('apiUrl')}/auth/me`,
          failOnStatusCode: false,
        }).its('status').should('eq', 200);
      },
    });
    cy.visit('/dashboard');
  });
});

Cypress.Commands.add('assertApiResponse', (alias: `@${string}`, expectedStatus: number) => {
  return cy.wait(alias).then((interception) => {
    expect(Boolean(interception.response), `${alias} tiene respuesta`).to.equal(true);
    expect(interception.response!.statusCode).to.eq(expectedStatus);
    const duration = apiDurationMs(interception.request);
    expect(duration).to.be.a('number').and.lessThan(Number(Cypress.expose('responseBudgetMs')));
    return interception;
  });
});

export {};
