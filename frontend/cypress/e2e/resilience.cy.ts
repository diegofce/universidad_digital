describe('Integración UI con respuestas API simuladas', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/auth/me', { statusCode: 401, body: { detail: 'Authentication required' } });
    cy.visit('/login');
  });

  it('valida credenciales vacías en el cliente sin enviar login', () => {
    cy.intercept('POST', '**/api/v1/auth/login').as('login');
    cy.contains('button', 'Iniciar sesión').click();
    cy.contains('Introduce un email válido').should('be.visible');
    cy.contains('La contraseña es obligatoria').should('be.visible');
    cy.get('@login.all').should('have.length', 0);
  });

  it('renderiza el error de login cuando la API responde 401', () => {
    const invalidEmail = 'no-existe@example.test';
    const invalidPassword = 'incorrecta';
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 401,
      body: { detail: 'Email o contraseña incorrectos.' },
    }).as('invalidLogin');
    cy.get('input[autocomplete="username"]').type(invalidEmail);
    cy.get('input[autocomplete="current-password"]').type(invalidPassword, { log: false });
    cy.contains('button', 'Iniciar sesión').click();
    cy.assertApiResponse('@invalidLogin', 401).then(({ request, response }) => {
      expect(request.body.email).to.eq(invalidEmail);
      expect(request.body.password).to.eq(invalidPassword);
      expect(response?.body).to.have.property('detail');
    });
    cy.get('[role="alert"]').should('be.visible');
    cy.location('pathname').should('eq', '/login');
  });

  it('presenta fallo 500 y desconexión durante login', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 500,
      body: { detail: 'Internal server error' },
    }).as('login500');
    cy.get('input[autocomplete="username"]').type('qa@example.test');
    cy.get('input[autocomplete="current-password"]').type('password-no-real', { log: false });
    cy.contains('button', 'Iniciar sesión').click();
    cy.assertApiResponse('@login500', 500);
    cy.get('[role="alert"]').should('be.visible');

    cy.intercept('POST', '**/api/v1/auth/login', { forceNetworkError: true }).as('loginOffline');
    cy.contains('button', 'Iniciar sesión').click();
    cy.wait('@loginOffline').should('have.property', 'error');
    cy.get('[role="alert"]').should('be.visible');
  });

  it('redirige cuando el endpoint de perfil informa sesión expirada', () => {
    cy.intercept('GET', '**/api/v1/auth/me', {
      statusCode: 401,
      body: { detail: 'Invalid authentication' },
    }).as('expiredSession');
    cy.visit('/dashboard');
    cy.wait('@expiredSession').its('response.statusCode').should('eq', 401);
    cy.location('pathname').should('eq', '/login');
  });

  it('muestra el error de lista ante cuerpo corrupto con HTTP 500', () => {
    stubAdminWorkspace();
    cy.intercept('GET', '**/api/v1/subjects/', {
      statusCode: 500,
      body: '{"detail":',
      headers: { 'content-type': 'application/json' },
    }).as('corruptSubjects');
    cy.visit('/admin/subjects');
    cy.assertApiResponse('@corruptSubjects', 500);
    cy.contains('[role="alert"]', 'No se pudo completar').should('be.visible');
  });

  it('muestra los datos recibidos de una respuesta parcial aislada', () => {
    stubAdminWorkspace();
    cy.intercept('GET', '**/api/v1/subjects/', {
      statusCode: 200,
      body: [{ id: 7, code: 'PARTIAL-QA' }],
    }).as('partialSubjects');
    cy.visit('/admin/subjects');
    cy.assertApiResponse('@partialSubjects', 200).its('response.body.0').should('not.have.property', 'name');
    cy.contains('td', 'PARTIAL-QA').should('be.visible');
  });

  it('renderiza errores HTTP, latencia y pérdida de conexión al crear', () => {
    stubAdminWorkspace();
    cy.intercept('GET', '**/api/v1/subjects/', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/v1/users/lookup?*', {
      statusCode: 200,
      fixture: 'teachers.json',
    }).as('teacherLookup');
    cy.visit('/admin/subjects');
    cy.contains('button', 'Crear materia').click();
    cy.contains('label', 'Código').parent().find('input').type('QA-RESILIENCE');
    cy.contains('label', 'Nombre').parent().find('input').type('Materia de resiliencia');
    cy.contains('label', 'Créditos').parent().find('input').clear().type('3');
    cy.get('#subject-teacher-search').type('teacher');
    cy.wait('@teacherLookup');
    cy.get('#subject-teacher option:not(:disabled)').first().then(($option) => {
      cy.get('#subject-teacher').select($option.val() as string);
    });

    cy.intercept('POST', '**/api/v1/subjects/', {
      statusCode: 500,
      body: { detail: 'Database operation failed' },
    }).as('create500');
    cy.contains('button', 'Guardar').click();
    cy.assertApiResponse('@create500', 500);
    cy.get('[role="status"]').should('contain.text', 'Database operation failed');

    cy.intercept('POST', '**/api/v1/subjects/', {
      delay: 1200,
      statusCode: 504,
      body: { detail: 'Gateway timeout' },
    }).as('createSlow');
    cy.contains('button', 'Guardar').click();
    cy.assertApiResponse('@createSlow', 504).its('response.body.detail').should('eq', 'Gateway timeout');
    cy.get('[role="status"]').should('contain.text', 'Gateway timeout');

    cy.intercept('POST', '**/api/v1/subjects/', { forceNetworkError: true }).as('createOffline');
    cy.contains('button', 'Guardar').click();
    cy.wait('@createOffline').should('have.property', 'error');
    cy.get('[role="status"]').should('contain.text', 'No se pudo conectar');
  });
});

function stubAdminWorkspace() {
  cy.intercept('GET', '**/api/v1/auth/me', {
    statusCode: 200,
    fixture: 'admin-user.json',
  });
}
