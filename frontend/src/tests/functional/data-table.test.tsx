import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../../components/tables/DataTable';

describe('DataTable', () => {
  it('shows the empty state when there are no records', () => {
    render(<DataTable headers={['Código']} rows={[]} empty="No hay materias." />);

    expect(screen.getByText('No hay materias.')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders headers and multiple records as a semantic table', () => {
    render(
      <DataTable
        headers={['Código', 'Nombre']}
        rows={[
          ['MAT-101', 'Matemáticas'],
          ['PHY-101', 'Física'],
        ]}
      />,
    );

    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: 'Física' })).toBeVisible();
  });

  it('reflects a rerender when the server-backed rows change', () => {
    const view = render(<DataTable headers={['Nombre']} rows={[['Matemáticas']]} />);

    view.rerender(<DataTable headers={['Nombre']} rows={[['Física']]} />);

    expect(screen.queryByRole('cell', { name: 'Matemáticas' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Física' })).toBeVisible();
  });
});
