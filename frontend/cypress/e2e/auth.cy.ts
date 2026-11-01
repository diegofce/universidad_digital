describe('Autenticación real contra FastAPI', () => {
  it('inicia sesión, establece cookies y conserva una sesión restaurada', () => {
    cy.loginAsAdmin();
    cy.location('pathname').should('eq', '/dashboard');
    cy.getCookie('csrf_token').should('exist');
    cy.env(['adminEmail']).then(({ adminEmail }) => {
      cy.request(`${Cypress.expose('apiUrl')}/auth/me`).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body.email).to.eq(adminEmail);
        expect(body.roles).to.include('administrator');
      });
    });
  });
});
