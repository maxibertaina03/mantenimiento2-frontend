import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CampoNumero } from './CampoNumero';

/** Envoltorio controlado, como se usa en las pantallas reales. */
function CampoControlado({
  inicial,
  alCambiar,
}: {
  inicial?: number;
  alCambiar?: (v: number | undefined) => void;
}) {
  const [valor, setValor] = useState<number | undefined>(inicial);
  return (
    <>
      <CampoNumero
        valor={valor}
        onCambio={(v) => {
          setValor(v);
          alCambiar?.(v);
        }}
        aria-label="cantidad"
      />
      <output data-testid="valor">{valor === undefined ? 'vacio' : String(valor)}</output>
    </>
  );
}

const campo = () => screen.getByLabelText('cantidad') as HTMLInputElement;
const valorEmitido = () => screen.getByTestId('valor').textContent;

describe('CampoNumero', () => {
  it('muestra el valor inicial', () => {
    render(<CampoControlado inicial={5} />);
    expect(campo().value).toBe('5');
  });

  it('un valor undefined se muestra como campo vacío', () => {
    render(<CampoControlado />);
    expect(campo().value).toBe('');
  });

  it('REGRESION: se puede borrar un 0 y el campo queda vacío', async () => {
    // Antes `Number('')` daba 0, el estado volvía a 0 y el campo se rellenaba
    // solo: era imposible vaciarlo.
    const user = userEvent.setup();
    render(<CampoControlado inicial={0} />);

    await user.clear(campo());

    expect(campo().value).toBe('');
    expect(valorEmitido()).toBe('vacio');
  });

  it('REGRESION: escribir sobre un 0 no deja ceros a la izquierda', async () => {
    const user = userEvent.setup();
    render(<CampoControlado inicial={0} />);

    await user.clear(campo());
    await user.type(campo(), '1');

    expect(campo().value).toBe('1');
    expect(valorEmitido()).toBe('1');
  });

  it('al salir del campo normaliza los ceros a la izquierda', async () => {
    const user = userEvent.setup();
    render(<CampoControlado />);

    await user.type(campo(), '01');
    await user.tab();

    expect(campo().value).toBe('1');
    expect(valorEmitido()).toBe('1');
  });

  it('emite el número mientras se escribe', async () => {
    const alCambiar = vi.fn();
    const user = userEvent.setup();
    render(<CampoControlado alCambiar={alCambiar} />);

    await user.type(campo(), '25');

    expect(alCambiar).toHaveBeenLastCalledWith(25);
  });

  it('deja escribir decimales sin cortar el tipeo', async () => {
    const user = userEvent.setup();
    render(<CampoControlado />);

    await user.type(campo(), '1.5');

    expect(campo().value).toBe('1.5');
    expect(valorEmitido()).toBe('1.5');
  });

  it('vaciar el campo emite undefined, no 0', async () => {
    const alCambiar = vi.fn();
    const user = userEvent.setup();
    render(<CampoControlado inicial={42} alCambiar={alCambiar} />);

    await user.clear(campo());

    expect(alCambiar).toHaveBeenLastCalledWith(undefined);
    // Un 0 acá seria un bug: "sin dato" y "cero" no son lo mismo.
    expect(alCambiar).not.toHaveBeenLastCalledWith(0);
  });

  it('el cero sí se puede escribir a propósito', async () => {
    const user = userEvent.setup();
    render(<CampoControlado />);

    await user.type(campo(), '0');

    expect(valorEmitido()).toBe('0');
  });

  it('se sincroniza cuando el valor cambia desde afuera (reset del form)', () => {
    const { rerender } = render(
      <CampoNumero valor={7} onCambio={() => {}} aria-label="cantidad" />,
    );
    expect(campo().value).toBe('7');

    rerender(<CampoNumero valor={undefined} onCambio={() => {}} aria-label="cantidad" />);
    expect(campo().value).toBe('');
  });

  it('deja pasar los atributos del input (min, step, required)', () => {
    render(
      <CampoNumero
        valor={1}
        onCambio={() => {}}
        aria-label="cantidad"
        min={0}
        step="0.001"
        required
      />,
    );
    expect(campo()).toHaveAttribute('min', '0');
    expect(campo()).toHaveAttribute('step', '0.001');
    expect(campo()).toBeRequired();
  });
});
