import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RotarCredencial, VerSecreto } from './AccionesCredencial';
import type { Credencial } from '@/api/credenciales';

/**
 * El baul de contrasenas.
 *
 * Lo que protegen estas pruebas es lo que hace que sea un gestor y no una
 * planilla: que la contrasena no se pida sola, que no quede a la vista, y que
 * no se guarde mal tipeada.
 */
const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => {
  class ApiError extends Error {
    constructor(
      public readonly statusCode: number,
      mensaje: string,
    ) {
      super(mensaje);
      this.name = 'ApiError';
    }
  }
  class ErrorServidorNoDisponible extends Error {}
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    ApiError,
    ErrorServidorNoDisponible,
  };
});

const credencial: Credencial = {
  id: 'cred-1',
  nombre: 'Correo administración',
  tipo: 'CORREO',
  usuario: 'administracion@lacteoslastres.com.ar',
  url: null,
  notas: null,
  equipoItId: null,
  equipoItNombre: null,
  rotarCadaDias: 90,
  rotadaEn: '2026-06-16T12:00:00.000Z',
  proximaRotacion: '2026-09-14T12:00:00.000Z',
  estadoRotacion: 'por-vencer',
  rotaciones: 0,
  vistas: 0,
  activo: true,
  creadoEn: '2026-06-16T12:00:00.000Z',
};

function envolver(nodo: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{nodo}</QueryClientProvider>);
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('VerSecreto', () => {
  it('REGRESION: no pide la contrasena hasta que alguien la pide', async () => {
    // Si se pidiera al abrir, el registro de quien la vio se llenaria de vistas
    // que nadie pidio, y dejaria de servir para lo unico que sirve.
    envolver(<VerSecreto credencial={credencial} onCerrar={() => {}} />);

    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Mostrar la contraseña/i })).toBeInTheDocument();
  });

  it('avisa que la consulta queda registrada ANTES de mostrarla', async () => {
    envolver(<VerSecreto credencial={credencial} onCerrar={() => {}} />);
    expect(screen.getByText(/queda registrado/i)).toBeInTheDocument();
  });

  it('la pide con POST y la muestra', async () => {
    apiRequestMock.mockResolvedValue({
      id: 'cred-1',
      nombre: 'Correo administración',
      usuario: 'administracion@lacteoslastres.com.ar',
      secreto: 'ClaveSecreta2026',
      vistaEn: '2026-09-14T10:00:00.000Z',
    });
    envolver(<VerSecreto credencial={credencial} onCerrar={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /Mostrar la contraseña/i }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    const [ruta, config] = apiRequestMock.mock.calls[0];
    expect(ruta).toBe('/credenciales/cred-1/revelar');
    // POST y no GET: un GET queda en el historial del navegador y en los
    // registros de acceso del servidor.
    expect(config.method).toBe('POST');
  });

  it('REGRESION: se tapa sola despues de un rato', async () => {
    // La duracion se acorta por prop en vez de usar relojes falsos: con relojes
    // falsos hay que sincronizar userEvent, React Query y los temporizadores de
    // React, y lo que se termina probando es esa sincronizacion.
    apiRequestMock.mockResolvedValue({
      id: 'cred-1',
      nombre: 'x',
      usuario: null,
      secreto: 'ClaveSecreta2026',
      vistaEn: '2026-09-14T10:00:00.000Z',
    });
    envolver(
      <VerSecreto credencial={credencial} onCerrar={() => {}} segundosVisible={0.05} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Mostrar la contraseña/i }));

    // La pantalla queda abierta en una oficina donde pasa gente: una contrasena
    // olvidada en un monitor es la forma mas comun de filtrar una.
    await waitFor(() => expect(screen.getByText(/Está tapada/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });
});

describe('RotarCredencial', () => {
  it('REGRESION: no deja guardar si las dos no son iguales', async () => {
    // Una contrasena guardada mal tipeada no avisa: se descubre el dia que
    // alguien la necesita y no entra, que suele ser el peor dia posible.
    envolver(<RotarCredencial credencial={credencial} onCerrar={() => {}} />);

    await userEvent.click(screen.getByLabelText('Contraseña nueva'));
    await userEvent.paste('ClaveNueva1');
    await userEvent.click(screen.getByLabelText('Repetila'));
    await userEvent.paste('ClaveNueva2');

    expect(screen.getByRole('button', { name: /Cambiar la contraseña/i })).toBeDisabled();
    expect(screen.getByText(/No son iguales/i)).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('guarda cuando las dos coinciden', async () => {
    apiRequestMock.mockResolvedValue(credencial);
    const cerrar = vi.fn();
    envolver(<RotarCredencial credencial={credencial} onCerrar={cerrar} />);

    await userEvent.click(screen.getByLabelText('Contraseña nueva'));
    await userEvent.paste('ClaveNueva1');
    await userEvent.click(screen.getByLabelText('Repetila'));
    await userEvent.paste('ClaveNueva1');
    await userEvent.click(screen.getByLabelText(/Por qué se cambia/i));
    await userEvent.paste('Se fue un empleado');
    await userEvent.click(screen.getByRole('button', { name: /Cambiar la contraseña/i }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    const [ruta, config] = apiRequestMock.mock.calls[0];
    expect(ruta).toBe('/credenciales/cred-1/rotar');
    expect(config.body).toEqual({ secreto: 'ClaveNueva1', motivo: 'Se fue un empleado' });
    expect(cerrar).toHaveBeenCalled();
  });

  it('los campos arrancan tapados', async () => {
    envolver(<RotarCredencial credencial={credencial} onCerrar={() => {}} />);
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('type', 'password');
  });

  it('avisa que la anterior no se guarda', async () => {
    envolver(<RotarCredencial credencial={credencial} onCerrar={() => {}} />);
    expect(screen.getByText(/anterior no se guarda/i)).toBeInTheDocument();
  });
});
