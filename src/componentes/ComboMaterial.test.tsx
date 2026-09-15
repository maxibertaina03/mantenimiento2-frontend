import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboMaterial } from './ComboMaterial';
import type { Material } from '@/tipos/material';

/**
 * El combo consulta la API por nombre en vez de cargar los ~831 materiales de
 * una. Estos tests fijan ese contrato (debounce, filtrado server-side y
 * seleccion) contra el apiClient mockeado.
 */
/** Forma de las opciones que el componente le pasa al apiClient. */
interface OpcionesApi {
  query?: Record<string, string | number | undefined | null>;
}

const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
}));

const material = (id: string, nombre: string, stockActual = 10): Material =>
  ({
    id,
    nombre,
    unidad: 'u',
    stockActual,
    stockMinimo: 0,
    categoriaId: 'c1',
    categoriaNombre: 'Cat',
    bajoStock: false,
    notas: null,
  }) as Material;

/** Un id con forma de los de verdad: la pistola escanea uno de estos. */
const ID_QR = '1e035e68-e43f-4776-9706-3e64fcd3fe33';
const BASE_QR = 'https://mantenimiento2-frontend.vercel.app';

const CATALOGO = [
  material('m1', 'Cable 2.5mm'),
  material('m2', 'Cable 4mm'),
  material('m3', 'Tornillo 6x40'),
  material(ID_QR, 'Reten 40x72x10'),
];

function envoltorio() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  apiRequestMock.mockReset();
  // Simula el filtrado server-side por nombre.
  apiRequestMock.mockImplementation(async (path: string, opciones: OpcionesApi = {}) => {
    if (/^\/materiales\/[^/]+$/.test(path)) {
      const id = path.split('/')[2];
      return CATALOGO.find((m) => m.id === id) ?? null;
    }
    const buscar = String(opciones?.query?.buscar ?? '').toLowerCase();
    const datos = buscar
      ? CATALOGO.filter((m) => m.nombre.toLowerCase().includes(buscar))
      : CATALOGO;
    return { datos, total: datos.length, pagina: 1, limite: 20 };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ComboMaterial', () => {
  it('no consulta el listado hasta que se abre el desplegable', () => {
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });
    expect(screen.queryByText(/Cable 2.5mm/)).not.toBeInTheDocument();
  });

  it('al enfocar muestra las opciones', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getByText(/Cable 2.5mm/)).toBeInTheDocument());
    expect(screen.getByText(/Tornillo 6x40/)).toBeInTheDocument();
  });

  it('filtra en el servidor, no en el cliente', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'cable');

    // El debounce es de 250ms.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      const llamadas = apiRequestMock.mock.calls.filter((c) => c[0] === '/materiales');
      const ultima = llamadas[llamadas.length - 1];
      expect(ultima[1].query.buscar).toBe('cable');
    });
  });

  it('hace debounce: tipear rapido no dispara una request por tecla', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    const input = screen.getByRole('textbox');
    await user.click(input);
    apiRequestMock.mockClear();

    await user.type(input, 'cable');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      const busquedas = apiRequestMock.mock.calls
        .filter((c) => c[0] === '/materiales')
        .map((c) => c[1]?.query?.buscar);
      // Debe quedar la busqueda completa, no una por cada letra tipeada.
      expect(busquedas).toContain('cable');
      expect(busquedas).not.toContain('c');
      expect(busquedas).not.toContain('ca');
    });
  });

  it('al elegir una opcion avisa al padre con el material completo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCambio = vi.fn();
    render(<ComboMaterial materialId="" onCambio={onCambio} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.getByText(/Cable 2.5mm/)).toBeInTheDocument());
    await user.click(screen.getByText(/Cable 2.5mm/));

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });

  it('tras elegir, cierra el desplegable y muestra el nombre elegido', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.getByText(/Tornillo 6x40/)).toBeInTheDocument());
    await user.click(screen.getByText(/Tornillo 6x40/));

    expect(screen.getByRole('textbox')).toHaveValue('Tornillo 6x40');
    expect(screen.queryByText(/Cable 2.5mm/)).not.toBeInTheDocument();
  });

  it('muestra el stock de cada opcion para decidir sin salir de la pantalla', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    await user.click(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getAllByText(/stock 10 u/).length).toBeGreaterThan(0));
  });

  it('precarga el material que llega por prop (ej: desde el detalle)', async () => {
    render(<ComboMaterial materialId="m3" onCambio={vi.fn()} />, { wrapper: envoltorio() });
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Tornillo 6x40'));
  });

  it('avisa cuando la busqueda no trae resultados', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} />, { wrapper: envoltorio() });

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'zzzznoexiste');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText(/Sin resultados/)).toBeInTheDocument());
  });
});

describe('ComboMaterial — alta desde el combo', () => {
  it('sin onCrear no ofrece crear nada', async () => {
    const usuario = userEvent.setup();
    render(<ComboMaterial materialId="" onCambio={() => {}} />, { wrapper: envoltorio() });
    await usuario.click(screen.getByRole('textbox'));
    await usuario.type(screen.getByRole('textbox'), 'cable inexistente');
    await waitFor(() => expect(screen.queryByText(/Crear el material/i)).not.toBeInTheDocument());
  });

  it('ofrece crear el material con el texto buscado', async () => {
    const alCrear = vi.fn();
    const usuario = userEvent.setup();
    render(<ComboMaterial materialId="" onCambio={() => {}} onCrear={alCrear} />, {
      wrapper: envoltorio(),
    });
    await usuario.click(screen.getByRole('textbox'));
    await usuario.type(screen.getByRole('textbox'), 'Valvula esferica');

    const boton = await screen.findByRole('button', { name: /Crear el material «Valvula esferica»/i });
    await usuario.click(boton);
    expect(alCrear).toHaveBeenCalledWith('Valvula esferica');
  });

  it('REGRESION: con el campo vacio tambien ofrece crear', async () => {
    // Antes solo aparecia al escribir algo, asi que la funcion quedaba
    // invisible justo para quien no sabe que existe.
    const alCrear = vi.fn();
    const usuario = userEvent.setup();
    render(<ComboMaterial materialId="" onCambio={() => {}} onCrear={alCrear} />, {
      wrapper: envoltorio(),
    });
    await usuario.click(screen.getByRole('textbox'));

    const boton = await screen.findByRole('button', { name: /Crear un material nuevo/i });
    await usuario.click(boton);
    expect(alCrear).toHaveBeenCalledWith('');
  });

  it('la opcion sigue apareciendo aunque haya resultados', async () => {
    // Puede que el material exista con un nombre parecido pero no sea el mismo.
    const alCrear = vi.fn();
    const usuario = userEvent.setup();
    render(<ComboMaterial materialId="" onCambio={() => {}} onCrear={alCrear} />, {
      wrapper: envoltorio(),
    });
    await usuario.click(screen.getByRole('textbox'));
    await usuario.type(screen.getByRole('textbox'), 'Cable');

    expect(await screen.findByText('Cable 2.5mm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear el material «Cable»/i })).toBeInTheDocument();
  });

  it('el texto se recorta antes de mandarlo', async () => {
    const alCrear = vi.fn();
    const usuario = userEvent.setup();
    render(<ComboMaterial materialId="" onCambio={() => {}} onCrear={alCrear} />, {
      wrapper: envoltorio(),
    });
    await usuario.click(screen.getByRole('textbox'));
    await usuario.type(screen.getByRole('textbox'), '  Buje bronce  ');
    await usuario.click(await screen.findByRole('button', { name: /Crear el material/i }));
    expect(alCrear).toHaveBeenCalledWith('Buje bronce');
  });
});

describe('ComboMaterial — pistola de codigos', () => {
  /**
   * Para el navegador la pistola es un teclado: deja la direccion escrita en el
   * campo de una y aprieta Enter. `paste` es lo mas parecido y no tarda 85
   * pulsaciones en correr.
   */
  const escanear = async (user: ReturnType<typeof userEvent.setup>, texto: string) => {
    await user.click(screen.getByRole('textbox'));
    await user.paste(texto);
  };

  it('REGRESION: un QR elige el material, no lo busca por nombre', async () => {
    // Sin esto el campo sale a buscar un material que se llame
    // «https://…/materiales/1e03…», que obviamente no existe.
    const alCambiar = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={alCambiar} />, { wrapper: envoltorio() });

    await escanear(user, `${BASE_QR}/materiales/${ID_QR}`);

    await waitFor(() =>
      expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ id: ID_QR })),
    );
  });

  it('lee igual un escaneo con la pistola mal configurada', async () => {
    const alCambiar = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={alCambiar} />, { wrapper: envoltorio() });

    await escanear(
      user,
      "httpsÑ--mantenimiento2'frontend.vercel.app-materiales-1e035e68'e43f'4776'9706'3e64fcd3fe33",
    );

    await waitFor(() =>
      expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ id: ID_QR })),
    );
  });

  it('con onEscaneo el campo queda libre para el siguiente', async () => {
    // Es lo que permite pasar diez etiquetas de corrido sin soltar la pistola:
    // el material se va a la orden y el buscador queda vacio.
    const alEscanear = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} onEscaneo={alEscanear} />, {
      wrapper: envoltorio(),
    });

    await escanear(user, `${BASE_QR}/materiales/${ID_QR}`);

    await waitFor(() =>
      expect(alEscanear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Reten 40x72x10' })),
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('REGRESION: el QR de un equipo no entra como material', async () => {
    // Las maquinas tambien tienen etiqueta y estan por toda la planta. Sin esto
    // se cargaria un id de equipo como si fuera un material.
    const alEscanear = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} onEscaneo={alEscanear} />, {
      wrapper: envoltorio(),
    });

    await escanear(user, `${BASE_QR}/equipos?equipo=${ID_QR}`);

    expect(await screen.findByText(/es de un equipo/i)).toBeInTheDocument();
    expect(alEscanear).not.toHaveBeenCalled();
  });

  it('un codigo que no es de ningun material lo dice', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ComboMaterial materialId="" onCambio={vi.fn()} onEscaneo={vi.fn()} />, {
      wrapper: envoltorio(),
    });

    await escanear(user, `${BASE_QR}/materiales/00000000-0000-0000-0000-000000000000`);

    expect(await screen.findByText(/no es de ningún material/i)).toBeInTheDocument();
  });

  it('REGRESION: el Enter con el que termina el escaneo no manda el formulario', async () => {
    // La pistola aprieta Enter sola al final. Adentro de la orden de compra ese
    // Enter la creaba con los renglones que hubiera hasta ese momento.
    const alEnviar = vi.fn((e: React.FormEvent) => e.preventDefault());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <form onSubmit={alEnviar}>
        <ComboMaterial materialId="" onCambio={vi.fn()} />
        <button type="submit">Crear orden</button>
      </form>,
      { wrapper: envoltorio() },
    );

    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Enter}');

    expect(alEnviar).not.toHaveBeenCalled();
  });
});
