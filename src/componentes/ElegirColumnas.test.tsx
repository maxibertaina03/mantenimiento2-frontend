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

describe('ElegirColumnas — vista previa', () => {
  const COLS: ColumnaReporte<{ nombre: string; stock: number }>[] = [
    { clave: 'material', titulo: 'Material', valor: (f) => f.nombre },
    { clave: 'stock', titulo: 'Stock', valor: (f) => f.stock },
  ];

  function abrirConMuestra() {
    render(
      <ElegirColumnas
        titulo="Exportar"
        reporte="previa"
        columnas={COLS}
        muestra={[
          { nombre: 'Rulemán 6204', stock: 4 },
          { nombre: 'Correa A40', stock: 1 },
        ]}
        totalFilas={120}
        onExportar={() => {}}
        onCerrar={() => {}}
      />,
    );
  }

  it('muestra las filas con las columnas tildadas, y cambia al destildar', () => {
    abrirConMuestra();
    const previa = screen.getByRole('region', { name: 'Vista previa del reporte' });
    expect(previa).toHaveTextContent('Rulemán 6204');
    expect(previa).toHaveTextContent('120 filas en total');
    expect(screen.getByRole('columnheader', { name: 'Stock' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Stock'));
    expect(screen.queryByRole('columnheader', { name: 'Stock' })).not.toBeInTheDocument();
    expect(previa).toHaveTextContent('1 columna · hoja vertical');
  });

  it('sin columnas, avisa en la vista previa', () => {
    abrirConMuestra();
    fireEvent.click(screen.getByLabelText('Material'));
    fireEvent.click(screen.getByLabelText('Stock'));
    expect(screen.getByText(/Tildá columnas a la izquierda/)).toBeInTheDocument();
  });
});
