import { SignIn } from '@clerk/clerk-react';

/** Pantalla de login (Clerk) centrada, para usuarios sin sesión. */
export function PantallaLogin() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        background: 'var(--color-fondo)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>🔧 Mantenimiento</h1>
        <p className="texto-suave" style={{ margin: 0 }}>
          Iniciá sesión para gestionar el stock de materiales.
        </p>
      </div>
      <SignIn />
    </div>
  );
}
