import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VERSION_PANTALLAS, VersionSistema } from './VersionSistema';

const apiRequestMock = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class extends Error {},
  ErrorServidorNoDisponible: class extends Error {},
}));

function mostrar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VersionSistema />
    </QueryClientProvider>,
  );
}

beforeEach(() => apiRequestMock.mockReset());

describe('VersionSistema', () => {
  it('muestra la versión de las pantallas enseguida, y la del servidor cuando contesta', async () => {
    apiRequestMock.mockResolvedValue({ version: '1.8.2', commit: 'abc1234' });
    mostrar();
    expect(VERSION_PANTALLAS).toMatch(/^\d+\.\d+\.\d+$/);
    // Antes de que conteste el servidor (que puede estar despertando), ya se
    // ve la de las pantallas: el pie no espera.
    expect(screen.getByText(`Pantallas v${VERSION_PANTALLAS}`)).toBeInTheDocument();
    expect(
      await screen.findByText(`Pantallas v${VERSION_PANTALLAS} · Servidor v1.8.2`),
    ).toBeInTheDocument();
  });
});
