import { useAuth } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { registrarObtenedorToken } from '@/lib/authToken';

/**
 * Registra el getToken de Clerk para que el apiClient pueda adjuntar el token.
 * Se hace en render (antes de que los hijos disparen requests) para evitar
 * la ventana en la que aún no había token disponible.
 */
export function ProveedorToken({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  registrarObtenedorToken(() => getToken());
  return <>{children}</>;
}
