import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iniciarMonitoreo } from '@/lib/monitoreo';
import { PantallaConError } from './PantallaConError';

function Rota(): never {
  throw new Error('se rompió al dibujarse');
}

describe('la red de seguridad de la app', () => {
  // React escribe el error en la consola: se calla para que el test se lea.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('REGRESION: una pantalla rota muestra el aviso en vez de quedar en blanco', () => {
    render(
      <PantallaConError>
        <Rota />
      </PantallaConError>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Algo falló al mostrar esta pantalla');
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });

  it('sin error muestra la pantalla normal', () => {
    render(
      <PantallaConError>
        <p>Todo bien</p>
      </PantallaConError>,
    );
    expect(screen.getByText('Todo bien')).toBeInTheDocument();
  });

  it('sin VITE_SENTRY_DSN el monitoreo no se prende', () => {
    expect(iniciarMonitoreo('')).toBe(false);
    expect(iniciarMonitoreo(undefined)).toBe(false);
  });
});
