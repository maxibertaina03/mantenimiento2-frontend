import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboEquipo } from './ComboEquipo';
import { ComboEquipoIt } from './ComboEquipoIt';

/**
 * Los dos buscadores de equipos y la pistola.
 *
 * Desde que los equipos de informatica tambien tienen etiqueta QR, cada campo
 * puede recibir la etiqueta del otro inventario. Aceptarla guardaria un id que
 * en esa tabla no existe, y el error recien aparece al guardar con un mensaje
 * que no explica nada. Cada uno tiene que rechazar lo que no es suyo Y decir
 * por que.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
}));

const ID_QR = '1e035e68-e43f-4776-9706-3e64fcd3fe33';
const BASE = 'https://mantenimiento2-frontend.vercel.app';

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ datos: [], total: 0, pagina: 1, limite: 20 });
});

function mostrar(nodo: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{nodo}</QueryClientProvider>);
}

describe('ComboEquipo (maquinas de planta)', () => {
  it('REGRESION: rechaza el QR de un equipo de informatica y explica por que', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    mostrar(<ComboEquipo onCambio={alCambiar} />);

    await usuario.click(screen.getByRole('textbox'));
    await usuario.paste(`${BASE}/equipos-it?equipo=${ID_QR}`);

    expect(await screen.findByText(/es de un equipo de informatica/i)).toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('acepta el QR de una maquina de planta', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    mostrar(<ComboEquipo onCambio={alCambiar} />);

    await usuario.click(screen.getByRole('textbox'));
    await usuario.paste(`${BASE}/equipos?equipo=${ID_QR}`);

    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ id: ID_QR }));
  });

  it('el QR de un material tampoco sirve aca', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    mostrar(<ComboEquipo onCambio={alCambiar} />);

    await usuario.click(screen.getByRole('textbox'));
    await usuario.paste(`${BASE}/materiales/${ID_QR}`);

    expect(await screen.findByText(/es de un material/i)).toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
  });
});

describe('ComboEquipoIt (informatica)', () => {
  it('acepta el QR de un equipo de informatica', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    mostrar(<ComboEquipoIt onCambio={alCambiar} />);

    await usuario.click(screen.getByRole('textbox'));
    await usuario.paste(`${BASE}/equipos-it?equipo=${ID_QR}`);

    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ id: ID_QR }));
  });

  it('REGRESION: rechaza el QR de una maquina de planta y explica por que', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    mostrar(<ComboEquipoIt onCambio={alCambiar} />);

    await usuario.click(screen.getByRole('textbox'));
    await usuario.paste(`${BASE}/equipos?equipo=${ID_QR}`);

    expect(await screen.findByText(/es de una máquina de planta/i)).toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
  });
});
