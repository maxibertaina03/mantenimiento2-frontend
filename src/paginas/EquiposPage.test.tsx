import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquiposPage } from './EquiposPage';

/**
 * La pantalla de equipos abierta desde un QR.
 *
 * El codigo pegado en la maquina lleva a /equipos?equipo=<id>. Si la pantalla
 * ignora el parametro, quien escanea parado frente a la maquina termina en el
 * listado de 326 y tiene que buscarla a mano, que es justo lo que el QR venia
 * a evitar.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

vi.mock('@/componentes/FotoEquipo', () => ({ FotoEquipo: () => null }));
vi.mock('@/componentes/PlanesEquipo', () => ({
  PlanesEquipo: () => null,
  textoVencimiento: () => '',
}));

const compresor = {
  id: 'eq-1',
  nombre: 'Compresor 1',
  codigoInterno: 'C-01',
  ubicacionNombre: 'Caldera',
  tipoNombre: null,
  marcaNombre: null,
  modeloNombre: null,
  estado: 'OPERATIVO',
  fotoUrl: null,
  qrGeneradoEn: null,
  garantiaVencida: false,
};

function servidor({ existe = true, resumen }: { existe?: boolean; resumen?: unknown } = {}) {
  apiRequestMock.mockImplementation((rutaCruda: string) => {
    const ruta = String(rutaCruda ?? '');
    if (ruta === '/equipos/resumen') {
      return Promise.resolve(
        resumen ?? {
          total: 1,
          porEstado: { OPERATIVO: 1 },
          porClasificacion: { EQUIPO: 290, HERRAMIENTA: 18 },
          tipos: [{ id: 't1', nombre: 'Motor', cantidad: 25 }],
          ubicaciones: [{ id: 'u1', nombre: 'Recibo', cantidad: 61 }],
          sinTipo: 7,
          sinPlan: 0,
        },
      );
    }
    if (ruta === '/equipos/eq-1') {
      return existe ? Promise.resolve(compresor) : Promise.reject(new Error('404'));
    }
    if (ruta.startsWith('/equipos')) {
      return Promise.resolve({ datos: [compresor], total: 1, pagina: 1, limite: 20 });
    }
    // Catálogos y demás.
    return Promise.resolve([]);
  });
}

function mostrar(ruta: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const nodo: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <EquiposPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(nodo);
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('EquiposPage abierta desde un QR', () => {
  it('REGRESION: con ?equipo=<id> abre la ficha de esa maquina', async () => {
    // Antes la pantalla ignoraba el parametro y mostraba el listado entero.
    servidor();
    mostrar('/equipos?equipo=eq-1');

    expect(await screen.findByRole('heading', { name: 'Compresor 1' })).toBeInTheDocument();
  });

  it('sin el parametro no abre ninguna ficha', async () => {
    servidor();
    mostrar('/equipos');

    await screen.findByText('Compresor 1');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Compresor 1' })).not.toBeInTheDocument(),
    );
  });

  it('un QR de una maquina que ya no existe lo dice, no se queda en blanco', async () => {
    // Etiqueta vieja, o pegada desde otra base de datos.
    servidor({ existe: false });
    mostrar('/equipos?equipo=eq-1');

    expect(await screen.findByText(/ya no está en el sistema/i)).toBeInTheDocument();
  });
});

/**
 * La cabecera, alineada con la de Equipos IT.
 *
 * Las tarjetas dicen lo que en ESTE modulo se puede accionar. Copiar las de
 * informatica tal cual daria "326 equipos, 326 Operativo": dos tarjetas que
 * ocupan lugar para decir lo mismo.
 */
describe('EquiposPage — resumen y filtros', () => {
  it('muestra el total y lo que falta hacer', async () => {
    servidor({
      resumen: { total: 326, porEstado: { OPERATIVO: 326 }, sinPlan: 326 },
    });
    mostrar('/equipos');

    // El numero y su etiqueta van en elementos separados, como en informatica.
    // El 326 aparece dos veces, en el total y en los que no tienen plan.
    // Sin pestania elegida la tarjeta dice "en total": estando en
    // Herramientas, decir "equipos" contradice lo que la persona eligio.
    expect(await screen.findByText('en total')).toBeInTheDocument();
    expect(screen.getByText('sin plan de mantenimiento')).toBeInTheDocument();
    expect(screen.getAllByText('326')).toHaveLength(3); // total, operativos y sin plan
    // "Operativo" aparece tambien en el desplegable de estados y en la fila.
    expect(screen.getAllByText('Operativo').length).toBeGreaterThan(0);
  });

  it('REGRESION: un resumen incompleto no rompe la pantalla', async () => {
    // Sin la guarda, `Object.entries(undefined)` tiraba abajo la pagina entera
    // y no se veia ni la tabla.
    servidor({ resumen: { total: 5 } });
    mostrar('/equipos');

    expect(await screen.findByRole('heading', { name: /Equipos y herramientas/ })).toBeInTheDocument();
  });

  it('los filtros que se usan todos los dias estan a la vista', async () => {
    servidor({});
    mostrar('/equipos');

    expect(await screen.findByLabelText('Filtrar por tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por ubicación')).toBeInTheDocument();
  });
});

/**
 * Maquinas y herramientas.
 *
 * El modulo paso a tener las dos cosas, y se buscan por separado. Lo que mas
 * importa proteger es el otro cambio: que los desplegables ofrezcan SOLO lo
 * que tiene algo. El catalogo tiene 49 ubicaciones y 16 con equipos, asi que
 * antes dos de cada tres opciones no llevaban a ningun lado.
 */
describe('EquiposPage — equipos y herramientas', () => {
  it('las pestanias muestran cuantos hay de cada cosa', async () => {
    servidor();
    mostrar('/equipos');

    expect(await screen.findByRole('button', { name: /Equipos\s*290/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Herramientas\s*18/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Todos\s*308/ })).toBeInTheDocument();
  });

  it('REGRESION: los desplegables solo ofrecen lo que tiene algo, con el numero', async () => {
    // Elegir una ubicacion vacia y que no salga nada es el defecto que esto
    // viene a arreglar.
    servidor();
    mostrar('/equipos');

    expect(await screen.findByRole('option', { name: 'Recibo (61)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Motor (25)' })).toBeInTheDocument();
  });

  it('elegir una pestania filtra el listado', async () => {
    const usuario = userEvent.setup();
    servidor();
    mostrar('/equipos');

    await usuario.click(await screen.findByRole('button', { name: /Herramientas\s*18/ }));

    await waitFor(() => {
      const llamada = apiRequestMock.mock.calls.find(
        (c) => String(c[0]) === '/equipos' && c[1]?.query?.clasificacion === 'HERRAMIENTA',
      );
      expect(llamada).toBeTruthy();
    });
  });

  it('REGRESION: cambiar de pestania limpia tipo y ubicacion', async () => {
    // Los tipos de una maquina no son los de una herramienta: si el filtro
    // quedara puesto, la pestania nueva apareceria vacia sin motivo visible.
    const usuario = userEvent.setup();
    servidor();
    mostrar('/equipos');

    // Las opciones llegan con el resumen: hay que esperarlas antes de elegir.
    await screen.findByRole('option', { name: 'Motor (25)' });
    await usuario.selectOptions(screen.getByLabelText(/Filtrar por tipo/i), 't1');
    await usuario.click(screen.getByRole('button', { name: /Herramientas\s*18/ }));

    await waitFor(() => {
      const ultima = [...apiRequestMock.mock.calls]
        .reverse()
        .find((c) => String(c[0]) === '/equipos');
      expect(ultima?.[1]?.query?.tipoId).toBeUndefined();
    });
  });
});
