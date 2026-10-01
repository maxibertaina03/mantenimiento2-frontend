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

  it('muestra la foto de cada equipo para reconocerlo, y la del elegido junto al campo', async () => {
    apiRequestMock.mockResolvedValue({
      datos: [
        { id: 'eq-1', nombre: 'Bomba 2', ubicacionNombre: 'Suero', fotoUrl: 'https://fotos/bomba2.jpg' },
        { id: 'eq-2', nombre: 'Bomba 3', ubicacionNombre: null, fotoUrl: null },
      ],
      total: 2,
      pagina: 1,
      limite: 20,
    });
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    const { container } = mostrar(<ComboEquipo onCambio={alCambiar} />);

    await usuario.click(screen.getByRole('textbox'));
    await screen.findByText('Bomba 2');
    const fotos = () => [...container.querySelectorAll('img.combo-foto')].map((i) => i.getAttribute('src'));
    // El que no tiene foto lleva el hueco, para que los nombres queden alineados.
    expect(fotos()).toEqual(['https://fotos/bomba2.jpg']);
    expect(container.querySelectorAll('.combo-foto-vacia')).toHaveLength(1);

    await usuario.click(screen.getByText('Bomba 2'));
    // Al padre le llega lo de siempre: id y nombre.
    expect(alCambiar).toHaveBeenCalledWith({ id: 'eq-1', nombre: 'Bomba 2' });
    expect(fotos()).toEqual(['https://fotos/bomba2.jpg']);
  });

  it('tocar la foto la agranda sin elegir el equipo; Escape la cierra sin cerrar el formulario', async () => {
    apiRequestMock.mockResolvedValue({
      datos: [{ id: 'eq-1', nombre: 'Bomba 2', ubicacionNombre: null, fotoUrl: 'https://fotos/bomba2.jpg' }],
      total: 1,
      pagina: 1,
      limite: 20,
    });
    // Lo que haría el modal de abajo con Escape: cerrarse.
    const modalSeCierra = vi.fn();
    const escuchaDelModal = (e: KeyboardEvent) => e.key === 'Escape' && modalSeCierra();
    document.addEventListener('keydown', escuchaDelModal);

    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    mostrar(<ComboEquipo onCambio={alCambiar} />);
    await usuario.click(screen.getByRole('textbox'));

    await usuario.click(await screen.findByRole('button', { name: 'Ver la foto de Bomba 2' }));
    expect(screen.getByRole('dialog', { name: 'Foto de Bomba 2' })).toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(modalSeCierra).not.toHaveBeenCalled();
    document.removeEventListener('keydown', escuchaDelModal);

    // La lista sigue abierta: se elige tocando el nombre.
    await usuario.click(screen.getByText('Bomba 2'));
    expect(alCambiar).toHaveBeenCalledWith({ id: 'eq-1', nombre: 'Bomba 2' });
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
