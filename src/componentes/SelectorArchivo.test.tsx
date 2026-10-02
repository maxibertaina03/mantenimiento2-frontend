import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectorArchivo } from './SelectorArchivo';

/** El selector de archivos del sistema: tocar o arrastrar, y decir qué se eligió. */
describe('SelectorArchivo', () => {
  it('se elige tocando, y dice qué archivo quedó elegido', async () => {
    const onElegir = vi.fn();
    const { container } = render(
      <SelectorArchivo titulo="Subí una foto" ayuda="JPG o PNG" accept="image/*" onElegir={onElegir} />,
    );
    const archivo = new File(['x'], 'bomba.jpg', { type: 'image/jpeg' });

    await userEvent.upload(container.querySelector('input[type=file]') as HTMLInputElement, archivo);

    expect(onElegir).toHaveBeenCalledWith([archivo]);
    expect(screen.getByText(/Elegido: bomba\.jpg/)).toBeInTheDocument();
  });

  it('se puede arrastrar un archivo encima', () => {
    const onElegir = vi.fn();
    render(<SelectorArchivo titulo="Subí el CSV" onElegir={onElegir} />);
    const archivo = new File(['a,b'], 'inventario.csv', { type: 'text/csv' });

    fireEvent.drop(screen.getByRole('button', { name: /Subí el CSV/ }).parentElement as HTMLElement, {
      dataTransfer: { files: [archivo] },
    });

    expect(onElegir).toHaveBeenCalledWith([archivo]);
  });

  it('mientras procesa dice qué está haciendo y no deja elegir otro', () => {
    render(<SelectorArchivo titulo="Subí una foto" ocupado="Subiendo…" onElegir={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Subiendo…/ })).toBeDisabled();
  });
});
