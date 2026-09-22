import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
      return Promise.resolve(resumen ?? { total: 1, porEstado: { OPERATIVO: 1 }, sinPlan: 0 });
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
    expect(await screen.findByText('equipos')).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'Equipos' })).toBeInTheDocument();
  });

  it('los filtros que se usan todos los dias estan a la vista', async () => {
    servidor({});
    mostrar('/equipos');

    expect(await screen.findByLabelText('Filtrar por tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por ubicación')).toBeInTheDocument();
  });
});
