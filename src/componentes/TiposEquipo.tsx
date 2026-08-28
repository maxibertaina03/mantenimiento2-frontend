import { useState } from 'react';
import {
  useActualizarTipoEquipo,
  useCrearTipoEquipo,
  useEliminarTipoEquipo,
  useTiposEquipo,
} from '@/api/equiposIt';
import { AccionesFila } from './AccionesFila';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';
import type { CrearTipoEquipoInput, TipoEquipo } from '@/tipos/equipoIt';

const FORM_VACIO: CrearTipoEquipoInput = {
  nombre: '',
  alias: '',
  llevaEspecificaciones: true,
  orden: 0,
  activo: true,
};

/**
 * Administración del catálogo de tipos de equipo.
 *
 * Antes los tipos eran un enum en la base: agregar "ISP" o "Cargador" requería
 * tocar el código y migrar. Ahora se dan de alta desde acá.
 */
export function TiposEquipo({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { data: tipos, isLoading, error } = useTiposEquipo();
  const eliminar = useEliminarTipoEquipo();
  const [editando, setEditando] = useState<TipoEquipo | null>(null);
  const [creando, setCreando] = useState(false);

  const borrar = async (t: TipoEquipo) => {
    if (!confirm(`¿Eliminar el tipo "${t.nombre}"?`)) return;
    await eliminar.mutateAsync(t.id);
  };

  return (
    <Modal titulo="Tipos de equipo" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave">
          Los tipos que se usan al cargar un equipo. Los <strong>alias</strong> son los términos
          que reconoce la importación de planillas.
        </p>

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}
        {eliminar.error && <MensajeError error={eliminar.error} />}

        {tipos && tipos.length === 0 && <EstadoVacio>No hay tipos cargados.</EstadoVacio>}

        {tipos && tipos.length > 0 && (
          <div className="tabla-scroll tabla-cards-contenedor">
            <table className="tabla tabla-cards">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Alias</th>
                  <th>Especificaciones</th>
                  <th>Equipos</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr key={t.id}>
                    <td data-etiqueta="Tipo">
                      <strong>{t.nombre}</strong>
                    </td>
                    <td data-etiqueta="Alias" className="texto-suave">
                      {t.alias || '—'}
                    </td>
                    <td data-etiqueta="Especificaciones">
                      {t.llevaEspecificaciones ? 'Pide RAM y disco' : 'No'}
                    </td>
                    <td data-etiqueta="Equipos">{t.equipos}</td>
                    <td data-etiqueta="Estado">
                      {t.activo ? (
                        <span className="badge badge-ok">Activo</span>
                      ) : (
                        <span className="badge">Inactivo</span>
                      )}
                    </td>
                    <td className="celda-acciones">
                      <AccionesFila
                        descripcion={`el tipo ${t.nombre}`}
                        onEditar={() => setEditando(t)}
                        // Un tipo en uso no se borra: se desactiva.
                        onEliminar={t.equipos === 0 ? () => borrar(t) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="texto-suave texto-chico">
          Un tipo que ya usan equipos no se puede eliminar: desactivalo y deja de ofrecerse al
          cargar, sin perder la clasificación de los que ya lo tienen.
        </p>

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            + Nuevo tipo
          </button>
        </div>
      </div>

      {(creando || editando) && (
        <FormularioTipo
          tipo={editando ?? undefined}
          alCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </Modal>
  );
}

function FormularioTipo({ tipo, alCerrar }: { tipo?: TipoEquipo; alCerrar: () => void }) {
  const esEdicion = tipo !== undefined;
  const [form, setForm] = useState<CrearTipoEquipoInput>(
    tipo
      ? {
          nombre: tipo.nombre,
          alias: tipo.alias ?? '',
          llevaEspecificaciones: tipo.llevaEspecificaciones,
          orden: tipo.orden,
          activo: tipo.activo,
        }
      : FORM_VACIO,
  );

  const crear = useCrearTipoEquipo();
  const actualizar = useActualizarTipoEquipo();
  const guardando = crear.isPending || actualizar.isPending;
  const error = crear.error ?? actualizar.error;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esEdicion) await actualizar.mutateAsync({ id: tipo.id, ...form });
    else await crear.mutateAsync(form);
    alCerrar();
  };

  return (
    <Modal
      titulo={esEdicion ? `Editar ${tipo.nombre}` : 'Nuevo tipo de equipo'}
      abierto
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <label>
          Nombre *
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            minLength={2}
            placeholder="Proyector"
          />
        </label>

        <label>
          Alias
          <input
            value={form.alias ?? ''}
            onChange={(e) => setForm({ ...form, alias: e.target.value })}
            placeholder="proyector,cañon"
          />
          <span className="texto-suave texto-chico">
            Separados por coma. Sirven para que la importación de planillas reconozca este tipo
            aunque esté escrito distinto.
          </span>
        </label>

        <label className="campo-check">
          <input
            type="checkbox"
            checked={form.llevaEspecificaciones ?? true}
            onChange={(e) => setForm({ ...form, llevaEspecificaciones: e.target.checked })}
          />
          Pedir procesador, RAM y disco al cargar un equipo de este tipo
        </label>

        <label className="campo-check">
          <input
            type="checkbox"
            checked={form.activo ?? true}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
          Activo (se ofrece al cargar equipos)
        </label>

        {error && <MensajeError error={error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear tipo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
