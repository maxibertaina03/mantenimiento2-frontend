import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

/**
 * Lo que se cuida: que un modal solo se cierre a propósito. Los usuarios
 * tocaban afuera o Escape, el modal se cerraba y perdían la orden a medio
 * cargar.
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
  return { onCerrar, tocarAfuera };
}

describe('Modal', () => {
  it('REGRESION: tocar afuera no lo cierra: pregunta, aunque no se haya cargado nada', async () => {
    const usuario = userEvent.setup();
    const { onCerrar, tocarAfuera } = mostrar();
    tocarAfuera();

    expect(onCerrar).not.toHaveBeenCalled();
    expect(
      screen.getByRole('alertdialog', { name: '¿Cerrar «Nueva orden de compra»?' }),
    ).toBeInTheDocument();
    // Y desde ahí se puede cerrar, para que nadie quede sin saber cómo salir.
    await usuario.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrar' }),
    );
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('con algo cargado, tocar afuera pregunta «¿Salir sin guardar?»', async () => {
    const usuario = userEvent.setup();
    const { onCerrar, tocarAfuera } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');

    tocarAfuera();

    expect(screen.getByRole('alertdialog', { name: '¿Salir sin guardar?' })).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('REGRESION: Escape no lo cierra: pregunta, y otro Escape vuelve al formulario', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar();

    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('REGRESION: seleccionar texto y soltar el mouse afuera no pregunta ni cierra', () => {
    const { onCerrar } = mostrar();
    const fondo = document.querySelector('.modal-fondo') as HTMLElement;
    fireEvent.mouseDown(screen.getByLabelText('Cantidad'));
    fireEvent.click(fondo);
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sin nada cargado, la ✕ cierra directo', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar();
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('con algo cargado, la ✕ pregunta; «Seguir cargando» vuelve con todo intacto', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('alertdialog', { name: '¿Salir sin guardar?' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Seguir cargando' }));

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad')).toHaveValue('4');
  });

  it('«Salir sin guardar» cierra', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    await usuario.click(screen.getByRole('button', { name: 'Salir sin guardar' }));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('con la pregunta abierta, Escape vuelve al formulario sin cerrar', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar();
    await usuario.type(screen.getByLabelText('Cantidad'), '4');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('con avisarSiHayCambios={false}, la ✕ cierra directo aunque haya algo cargado', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = mostrar({ avisarSiHayCambios: false });
    await usuario.type(screen.getByLabelText('Cantidad'), '4');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
