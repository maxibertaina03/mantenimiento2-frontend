import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectConAlta } from './SelectConAlta';

/** El desplegable de marca o modelo que deja cargar lo que falta ahí mismo. */
function mostrar(extra: Partial<Parameters<typeof SelectConAlta>[0]> = {}) {
  const props = {
    etiqueta: 'Marca',
    valor: '',
    vacio: 'Sin marca',
    textoAgregar: '+ Agregar marca…',
    puedeAgregar: true,
    opciones: [{ id: 'm-1', nombre: 'WEG' }],
    onCambio: vi.fn(),
    onAgregar: vi.fn(async () => 'm-nueva'),
    ...extra,
  };
  render(<SelectConAlta {...props} />);
  return props;
}

describe('SelectConAlta', () => {
  it('REGRESION: con la lista vacía igual ofrece agregar', () => {
    mostrar({ opciones: [] });
    expect(screen.getByRole('option', { name: '+ Agregar marca…' })).toBeInTheDocument();
  });

  it('agregar crea la marca y la deja elegida', async () => {
    const usuario = userEvent.setup();
    const p = mostrar();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Marca' }), '+ Agregar marca…');
    await usuario.type(screen.getByRole('textbox', { name: /marca nueva/ }), 'Siemens{Enter}');

    expect(p.onAgregar).toHaveBeenCalledWith('Siemens');
    expect(p.onCambio).toHaveBeenCalledWith('m-nueva');
    // Vuelve al desplegable.
    expect(screen.getByRole('combobox', { name: 'Marca' })).toBeInTheDocument();
  });

  it('si falla, dice por qué y deja corregir', async () => {
    const usuario = userEvent.setup();
    mostrar({ onAgregar: vi.fn(async () => Promise.reject(new Error('Ya existe una marca WEG'))) });

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Marca' }), '+ Agregar marca…');
    await usuario.type(screen.getByRole('textbox', { name: /marca nueva/ }), 'weg');
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText(/Ya existe una marca WEG/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /marca nueva/ })).toHaveValue('weg');
  });

  it('sin permiso no ofrece agregar', () => {
    mostrar({ puedeAgregar: false });
    expect(screen.queryByRole('option', { name: /Agregar/ })).not.toBeInTheDocument();
  });
});
