import { useState } from 'react';
import { useActualizarProveedor } from '@/api/proveedores';
import { esEmailValido } from '@/lib/envioOrden';
import { MensajeError } from './Estados';

/**
 * Carga el correo y el teléfono del proveedor sin salir de la pantalla de envío.
 *
 * Existe porque el dato falta casi siempre: de los 1067 proveedores cargados,
 * 6 tienen correo y 99 tienen teléfono. Sin esto hay que ir a Proveedores,
 * buscarlo entre mil, editarlo y volver, y en la práctica nadie lo hace: se
 * manda a administración y listo. El momento en que alguien se entera de que
 * falta el dato es justo este, así que es acá donde tiene que poder cargarlo.
 */
export function ContactoProveedor({
  proveedorId,
  nombre,
  email,
  telefono,
  onGuardado,
}: {
  proveedorId: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState(email ?? '');
  const [nuevoTelefono, setNuevoTelefono] = useState(telefono ?? '');
  const actualizar = useActualizarProveedor();

  const emailRoto = nuevoEmail.trim() !== '' && !esEmailValido(nuevoEmail);

  const guardar = async () => {
    await actualizar.mutateAsync({
      id: proveedorId,
      input: {
        email: nuevoEmail.trim() || null,
        telefono: nuevoTelefono.trim() || null,
      },
    });
    setAbierto(false);
    onGuardado();
  };

  if (!abierto) {
    return (
      <button className="btn btn-chico" onClick={() => setAbierto(true)}>
        ✎ {email || telefono ? 'Corregir el contacto' : 'Cargar correo o teléfono'}
      </button>
    );
  }

  return (
    <div className="panel panel-embebido">
      <p className="texto-suave texto-chico" style={{ marginTop: 0 }}>
        Queda guardado en la ficha de <strong>{nombre ?? 'el proveedor'}</strong>, así la próxima
        orden ya sale sin cargar nada.
      </p>

      <div className="campo">
        <label>Correo</label>
        <input
          type="email"
          value={nuevoEmail}
          placeholder="compras@proveedor.com.ar"
          onChange={(e) => setNuevoEmail(e.target.value)}
        />
        {emailRoto && (
          <span className="texto-suave texto-chico">
            Eso no parece una dirección de correo. Revisala antes de guardar.
          </span>
        )}
      </div>

      <div className="campo">
        <label>Teléfono</label>
        <input
          value={nuevoTelefono}
          placeholder="+54 9 3564 12-3456"
          onChange={(e) => setNuevoTelefono(e.target.value)}
        />
      </div>

      {actualizar.error && <MensajeError error={actualizar.error} />}

      <div className="acciones">
        <button className="btn btn-primario" onClick={guardar} disabled={emailRoto || actualizar.isPending}>
          {actualizar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
