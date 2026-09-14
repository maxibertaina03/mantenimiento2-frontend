import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectorCatalogo } from './SelectorCatalogo';

/**
 * El desplegable de catalogo con alta en el mismo formulario.
 *
 * Es lo que hace que el catalogo se pueda usar. Si para cargar una marca que
 * falta hubiera que cerrar el formulario, ir a otra pantalla y volver a
 * empezar, nadie lo haria: escribirian cualquier cosa, que es exactamente lo
 * que el catalogo viene a evitar.
 */
const opciones = [
  { id: 'm-1', nombre: 'HP' },
  { id: 'm-2', nombre: 'Lenovo' },
];

function montar(extra: Partial<Parameters<typeof SelectorCatalogo>[0]> = {}) {
  const onCambiar = vi.fn();
  const onCrear = vi.fn(async () => 'm-nueva');
  render(
    <SelectorCatalogo
      id="marca"
      etiqueta="Marca"
      valor=""
      opciones={opciones}
      onCambiar={onCambiar}
      onCrear={onCrear}
      {...extra}
    />,
  );
  return { onCambiar, onCrear };
}

describe('SelectorCatalogo', () => {
  it('muestra las opciones del catalogo', () => {
    montar();
    expect(screen.getByRole('option', { name: 'HP' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lenovo' })).toBeInTheDocument();
  });

  it('REGRESION: al cargar uno nuevo lo deja elegido', async () => {
    // Si no quedara elegido, habria que buscarlo en la lista despues de
    // crearlo, y el paso extra es justo lo que hace que la gente no lo use.
    const { onCambiar, onCrear } = montar();

    await userEvent.click(screen.getByRole('button', { name: /Nueva/i }));
    await userEvent.click(screen.getByLabelText('Marca'));
    await userEvent.paste('Brother');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(onCrear).toHaveBeenCalledWith('Brother'));
    expect(onCambiar).toHaveBeenCalledWith('m-nueva');
  });

  it('no deja agregar un nombre vacio', async () => {
    const { onCrear } = montar();
    await userEvent.click(screen.getByRole('button', { name: /Nueva/i }));
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
    expect(onCrear).not.toHaveBeenCalled();
  });

  it('se puede volver atras sin cargar nada', async () => {
    // Entrar por error al modo "nuevo" no tiene que dejar a nadie atrapado.
    const { onCrear } = montar();
    await userEvent.click(screen.getByRole('button', { name: /Nueva/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(onCrear).not.toHaveBeenCalled();
  });

  it('muestra el error si el alta falla, sin perder lo escrito', async () => {
    const onCambiar = vi.fn();
    const onCrear = vi.fn(async () => {
      throw new Error('Ya hay una marca llamada "HP".');
    });
    render(
      <SelectorCatalogo
        id="marca"
        etiqueta="Marca"
        valor=""
        opciones={opciones}
        onCambiar={onCambiar}
        onCrear={onCrear}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Nueva/i }));
    await userEvent.click(screen.getByLabelText('Marca'));
    await userEvent.paste('hp');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(screen.getByText(/Ya hay una marca/)).toBeInTheDocument());
    expect(screen.getByLabelText('Marca')).toHaveValue('hp');
    expect(onCambiar).not.toHaveBeenCalled();
  });

  it('REGRESION: un item desactivado no se ofrece, salvo que sea el que ya esta puesto', () => {
    // Sacarle de golpe el valor a una ficha vieja seria peor que mostrarlo.
    const conInactivo = [
      { id: 'm-1', nombre: 'HP' },
      { id: 'm-3', nombre: 'Compaq', activo: false },
    ];
    const { unmount } = render(
      <SelectorCatalogo
        id="a"
        etiqueta="Marca"
        valor=""
        opciones={conInactivo}
        onCambiar={vi.fn()}
        onCrear={vi.fn(async () => 'x')}
      />,
    );
    expect(screen.queryByRole('option', { name: /Compaq/ })).not.toBeInTheDocument();
    unmount();

    render(
      <SelectorCatalogo
        id="b"
        etiqueta="Marca"
        valor="m-3"
        opciones={conInactivo}
        onCambiar={vi.fn()}
        onCrear={vi.fn(async () => 'x')}
      />,
    );
    expect(screen.getByRole('option', { name: /Compaq/ })).toBeInTheDocument();
  });

  it('deshabilitado no deja ni elegir ni crear', () => {
    montar({ deshabilitado: true, ayuda: 'Elegí la marca primero.' });
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Nueva/i })).toBeDisabled();
    expect(screen.getByText('Elegí la marca primero.')).toBeInTheDocument();
  });
});
