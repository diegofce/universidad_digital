describe('Navegación real', () => {
  it('redirige al login si el backend confirma que no hay sesión', () => {
    cy.intercept('GET', '**/api/v1/auth/me').as('anonymousProfile');
    cy.visit('/dashboard');
    cy.wait('@anonymousProfile').then(({ response }) => {
      expect(response?.statusCode).to.eq(401);
      expect(response?.body).to.have.property('detail');
    });
    cy.location('pathname').should('eq', '/login');
  });

  it('muestra dashboard autenticado con los datos reales de la API', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '**/api/v1/subjects/').as('dashboardSubjects');
    cy.visit('/dashboard');
    cy.assertApiResponse('@dashboardSubjects', 200).then(({ response }) => {
      expect(response?.body).to.be.an('array');
    });
    cy.contains('h1', 'Hola,').should('be.visible');
    cy.contains('Materias visibles').parent().should('contain.text', 'Materias visibles');
  });
});
