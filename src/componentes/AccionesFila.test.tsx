import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccionesFila, DatoFicha } from './AccionesFila';

describe('AccionesFila', () => {
  it('muestra solo las acciones que recibe', () => {
    render(<AccionesFila descripcion="el proveedor X" onEditar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver/i })).not.toBeInTheDocument();
  });

  it('REGRESION: los íconos llevan nombre accesible', () => {
    // Un ✏️ o una ✕ sin etiqueta no le dicen nada a un lector de pantalla.
    render(
      <AccionesFila
        descripcion="el proveedor Ferretería Central"
        onVer={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Ver el proveedor Ferretería Central' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Editar el proveedor Ferretería Central' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Eliminar el proveedor Ferretería Central' }),
    ).toBeInTheDocument();
  });

  it('cada botón dispara su acción', async () => {
    const user = userEvent.setup();
    const onVer = vi.fn();
    const onEditar = vi.fn();
    const onEliminar = vi.fn();
    render(
      <AccionesFila
        descripcion="el material"
        onVer={onVer}
        onEditar={onEditar}
        onEliminar={onEliminar}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Ver/ }));
    await user.click(screen.getByRole('button', { name: /^Editar/ }));
    await user.click(screen.getByRole('button', { name: /^Eliminar/ }));

    expect(onVer).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onEliminar).toHaveBeenCalledTimes(1);
  });

  it('son botones de tipo button: no envían el formulario que los contenga', () => {
    render(<AccionesFila descripcion="x" onEditar={vi.fn()} onEliminar={vi.fn()} />);
    for (const boton of screen.getAllByRole('button')) {
      expect(boton).toHaveAttribute('type', 'button');
    }
  });
});

describe('DatoFicha', () => {
  it('muestra la etiqueta y el valor', () => {
    render(<DatoFicha etiqueta="CUIT" valor="30-12345678-9" />);
    expect(screen.getByText('CUIT')).toBeInTheDocument();
    expect(screen.getByText('30-12345678-9')).toBeInTheDocument();
  });

  it.each([null, undefined, ''])('no rinde nada si el valor es %p', (valor) => {
    const { container } = render(<DatoFicha etiqueta="Email" valor={valor} />);
    // Una ficha con "Email: —" repetido para cada campo vacío es puro ruido.
    expect(container).toBeEmptyDOMElement();
  });

  it('el 0 sí se muestra (es un valor, no un vacío)', () => {
    render(<DatoFicha etiqueta="Stock" valor={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
