describe('E2E real: materias y PostgreSQL QA', () => {
  let createdSubjectId: number | undefined;
  const dbWrite = Cypress.expose('allowDbWrites') ? it : it.skip;

  beforeEach(() => {
    createdSubjectId = undefined;
    cy.loginAsAdmin();
    cy.intercept('GET', '**/api/v1/subjects/').as('subjectList');
    cy.visit('/admin/subjects');
    cy.assertApiResponse('@subjectList', 200).its('response.body').should('be.an', 'array');
  });

  afterEach(() => {
    if (createdSubjectId === undefined) return;
    cy.getCookie('csrf_token').should('exist').then((csrf) => {
      cy.request({
        method: 'DELETE',
        url: `${Cypress.expose('apiUrl')}/subjects/${createdSubjectId}`,
        headers: { 'X-CSRF-Token': csrf!.value },
      }).its('status').should('eq', 204);
    });
  });

  it('rechaza un formulario incompleto sin invocar POST', () => {
    cy.intercept('POST', '**/api/v1/subjects/').as('createEmpty');
    cy.contains('button', 'Crear materia').click();
    cy.contains('button', 'Guardar').click();
    cy.get('@createEmpty.all').should('have.length', 0);
  });

  it('valida el schema real de FastAPI y responde 422 sin persistir', () => {
    cy.getCookie('csrf_token').should('exist').then((csrf) => {
      cy.request({
        method: 'POST',
        url: `${Cypress.expose('apiUrl')}/subjects/`,
        headers: { 'X-CSRF-Token': csrf!.value },
        body: { code: 'CODIGO CON ESPACIOS', name: '', credits: 0 },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(422);
        expect(Array.isArray(response.body.detail) && response.body.detail.length > 0).to.equal(true);
        expect(response.duration).to.be.lessThan(Number(Cypress.expose('responseBudgetMs')));
      });
    });
  });

  dbWrite('crea una materia única, verifica API/UI y la vuelve a leer tras recargar', () => {
    cy.fixture('subjects').then(({ valid }) => {
      const subject = { ...valid, code: `QA${Date.now()}` };
      let teacherId = 0;
      cy.contains('button', 'Crear materia').click();
      cy.contains('label', 'Código').parent().find('input').type(subject.code);
      cy.contains('label', 'Nombre').parent().find('input').type(subject.name);
      cy.contains('label', 'Descripción').parent().find('input').type(subject.description);
      cy.contains('label', 'Créditos').parent().find('input').clear().type(String(subject.credits));

      cy.intercept('GET', '**/api/v1/users/lookup?*').as('teacherLookup');
      const teacherSearch = Cypress.expose('teacherSearch') as string;
      expect(teacherSearch.length).to.be.greaterThan(1);
      cy.get('#subject-teacher-search').type(teacherSearch);
      cy.assertApiResponse('@teacherLookup', 200).then(({ response }) => {
        expect(Array.isArray(response?.body) && response.body.length > 0).to.equal(true);
      });
      cy.get('#subject-teacher option:not(:disabled)').first().then(($option) => {
        cy.get('#subject-teacher').select($option.val() as string);
      });

      cy.intercept('POST', '**/api/v1/subjects/').as('createSubject');
      cy.intercept('GET', '**/api/v1/subjects/').as('refreshedSubjects');
      cy.contains('button', 'Guardar').click();
      cy.assertApiResponse('@createSubject', 201).then(({ request, response }) => {
        if (typeof response?.body?.id === 'number') createdSubjectId = response.body.id;
        expect(request.body).to.include(subject);
        expect(request.body.teacher_id).to.be.a('number').and.greaterThan(0);
        expect(response?.body).to.include({ ...subject, is_active: true });
        expect(response?.body.teacher_id).to.eq(request.body.teacher_id);
        expect(response?.body.id).to.be.a('number');
        teacherId = response!.body.teacher_id;
      });
      cy.assertApiResponse('@refreshedSubjects', 200).then(({ response }) => {
        const persistedInList = (response?.body as Array<Record<string, unknown>>).find(
          (item) => item.code === subject.code,
        );
        expect(persistedInList).to.include({ ...subject, is_active: true, teacher_id: teacherId });
      });
      cy.contains('[role="status"]', 'Operación completada correctamente.').should('be.visible');
      cy.contains('td', subject.code).should('be.visible').parent('tr').within(() => {
        cy.contains('td', subject.name).should('be.visible');
        cy.contains('td', String(subject.credits)).should('be.visible');
      });

      cy.intercept('GET', '**/api/v1/subjects/').as('subjectsAfterReload');
      cy.reload();
      cy.assertApiResponse('@subjectsAfterReload', 200).then(({ response }) => {
        const persisted = (response?.body as Array<Record<string, unknown>>).find(
          (item) => item.code === subject.code,
        );
        expect(persisted).to.include({ ...subject, is_active: true, teacher_id: teacherId });
      });
      cy.contains('td', subject.code).should('be.visible');
    });
  });
});
