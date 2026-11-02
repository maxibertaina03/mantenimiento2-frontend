import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnaReporte } from '@/lib/columnasReporte';
import { ElegirColumnas } from './ElegirColumnas';

const COLUMNAS: ColumnaReporte<{ a: string }>[] = [
  { clave: 'material', titulo: 'Material', valor: (f) => f.a },
  { clave: 'stock', titulo: 'Stock', valor: (f) => f.a },
  { clave: 'notas', titulo: 'Notas', valor: (f) => f.a, porDefecto: false },
];

afterEach(() => localStorage.clear());

function abrir(onExportar = vi.fn()) {
  render(
    <ElegirColumnas
      titulo="Exportar"
      reporte="prueba"
      columnas={COLUMNAS}
      onExportar={onExportar}
      onCerrar={() => {}}
    />,
  );
  return onExportar;
}

describe('ElegirColumnas', () => {
  it('viene con las de siempre y exporta las que quedan tildadas', () => {
    const onExportar = abrir();
    expect(screen.getByLabelText('Notas')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Stock'));
    fireEvent.click(screen.getByLabelText('Notas'));
    fireEvent.click(screen.getByRole('button', { name: /PDF/ }));
    expect(onExportar).toHaveBeenCalledWith('pdf', ['material', 'notas']);
  });

  it('la planilla también lleva solo las tildadas', () => {
    const onExportar = abrir();
    fireEvent.click(screen.getByLabelText('Material'));
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    expect(onExportar).toHaveBeenCalledWith('csv', ['stock']);
  });

  it('sin ninguna columna no deja exportar', () => {
    abrir();
    fireEvent.click(screen.getByLabelText('Material'));
    fireEvent.click(screen.getByLabelText('Stock'));
    expect(screen.getByRole('button', { name: /PDF/ })).toBeDisabled();
    expect(screen.getByText('Elegí al menos una columna.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getByLabelText('Notas')).toBeChecked();
  });
});
