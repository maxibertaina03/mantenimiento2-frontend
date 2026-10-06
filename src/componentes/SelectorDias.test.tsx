import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { describirDias } from '@/lib/diasDeTrabajo';
import { SelectorDias } from './SelectorDias';

describe('describirDias', () => {
  it('dice los días como se dicen en la planta', () => {
    expect(describirDias([1, 2, 3, 4, 5])).toBe('De lunes a viernes');
    expect(describirDias([0, 1, 2, 3, 4, 5, 6])).toBe('Todos los días');
    expect(describirDias([1, 2, 3, 4, 5, 6])).toBe('De lunes a sábado');
    expect(describirDias([1, 3, 5])).toBe('lun, mié, vie');
    // Sin el dato (un plan viejo), lo mismo que el sistema: lunes a viernes.
    expect(describirDias(undefined)).toBe('De lunes a viernes');
  });
});

describe('SelectorDias', () => {
  it('marcar el sábado lo suma; los atajos cambian todo de una', async () => {
    const onCambio = vi.fn();
    const usuario = userEvent.setup();
    render(<SelectorDias dias={[1, 2, 3, 4, 5]} onCambio={onCambio} />);

    expect(screen.getByRole('button', { name: 'sábado' })).toHaveAttribute('aria-pressed', 'false');
    await usuario.click(screen.getByRole('button', { name: 'sábado' }));
    expect(onCambio).toHaveBeenLastCalledWith([1, 2, 3, 4, 5, 6]);

    await usuario.click(screen.getByRole('button', { name: 'Todos' }));
    expect(onCambio).toHaveBeenLastCalledWith([0, 1, 2, 3, 4, 5, 6]);
  });

  it('REGRESION: no deja sacar el último día', async () => {
    const onCambio = vi.fn();
    const usuario = userEvent.setup();
    render(<SelectorDias dias={[3]} onCambio={onCambio} />);

    await usuario.click(screen.getByRole('button', { name: 'miércoles' }));
    expect(onCambio).not.toHaveBeenCalled();
  });
});
