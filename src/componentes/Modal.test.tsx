import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

/**
 * Lo que se cuida: que una orden a medio cargar no se pierda por un clic de
 * más. Los usuarios tocaban afuera, el modal se cerraba y se perdía todo.
 */
function mostrar(props: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onCerrar = vi.fn();
  const utils = render(
    <Modal titulo="Nueva orden de compra" abierto onCerrar={onCerrar} {...props}>
      <label>
        Cantidad
        <input aria-label="Cantidad" />
      </label>
    </Modal>,
  );
  const fondo = utils.container.querySelector('.modal-fondo') as HTMLElement;
  const tocarAfuera = () => {
    fireEvent.mouseDown(fondo);
    fireEvent.click(fondo);
  };
  return { onCerrar, tocarAfuera, fondo };
}

describe('Modal', () => {
  it('sin nada cargado, tocar afuera lo cierra como siempre', () => {
    const { onCerrar, tocarAfuera } = mostrar();
    tocarAfuera();
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('REGRESION: con algo cargado, tocar afuera pregunta en vez de cerrar', async () => {
    const usuario = userEvent.setup();
    const { onCerrar, tocarAfuera } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');

    tocarAfuera();

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: '¿Salir sin guardar?' })).toBeInTheDocument();
  });

  it('«Seguir cargando» vuelve al formulario con lo cargado intacto', async () => {
    const usuario = userEvent.setup();
    const { onCerrar, tocarAfuera } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');
    tocarAfuera();

    await usuario.click(screen.getByRole('button', { name: 'Seguir cargando' }));

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad')).toHaveValue('4');
  });

  it('«Salir sin guardar» cierra', async () => {
    const usuario = userEvent.setup();
    const { onCerrar, tocarAfuera } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');
    tocarAfuera();

    await usuario.click(screen.getByRole('button', { name: 'Salir sin guardar' }));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('la ✕ y Escape también preguntan; Escape otra vez vuelve al formulario', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('REGRESION: seleccionar texto y soltar el mouse afuera no lo cierra', () => {
    const { onCerrar, fondo } = mostrar();
    // El clic empieza adentro (en el campo) y termina en el fondo.
    fireEvent.mouseDown(screen.getByLabelText('Cantidad'));
    fireEvent.click(fondo);
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('con avisarSiHayCambios={false} cierra directo aunque haya algo cargado', async () => {
    const usuario = userEvent.setup();
    const { onCerrar, tocarAfuera } = mostrar({ avisarSiHayCambios: false });
    await usuario.type(screen.getByLabelText('Cantidad'), '4');
    tocarAfuera();
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('con un modal sobre otro, Escape es solo del de arriba', async () => {
    const usuario = userEvent.setup();
    const deAbajo = vi.fn();
    const deArriba = vi.fn();
    render(
      <>
        <Modal titulo="Orden" abierto onCerrar={deAbajo}>
          <p>orden</p>
        </Modal>
        <Modal titulo="Material nuevo" abierto onCerrar={deArriba}>
          <p>material</p>
        </Modal>
      </>,
    );

    await usuario.keyboard('{Escape}');

    expect(deArriba).toHaveBeenCalledTimes(1);
    expect(deAbajo).not.toHaveBeenCalled();
  });
});
