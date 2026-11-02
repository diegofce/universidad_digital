import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../routes/AppRoutes';

describe('application routes', () => {
  it('shows the not-found destination for unknown application paths', () => {
    render(<MemoryRouter initialEntries={['/not-a-real-section']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    expect(screen.getByText('La ruta solicitada no existe.')).toBeVisible();
  });
});
