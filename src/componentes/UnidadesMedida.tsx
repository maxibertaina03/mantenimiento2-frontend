import { useState } from 'react';
import {
  useActualizarUnidad,
  useCrearUnidad,
  useEliminarUnidad,
  useUnidadesMedida,
} from '@/api/unidadesMedida';
import { useAsignarUnidadMasiva, useMaterialesSinUnidad } from '@/api/materiales';
import { AccionesFila } from './AccionesFila';
import { CampoNumero } from './CampoNumero';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';
import type { UnidadMedida } from '@/tipos/unidadMedida';

/**
 * Administración del catálogo de unidades de medida.
 *
 * La unidad dejó de ser texto libre: antes cada uno escribía la suya y "lt",
 * "Lt" y "litros" terminaban siendo tres unidades distintas, así que cualquier
 * reporte que agrupe por unidad daba números que no cierran.
 */
export function UnidadesMedida({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { data: unidades, isLoading, error } = useUnidadesMedida();
  const eliminar = useEliminarUnidad();
  const actualizar = useActualizarUnidad();
  const [editando, setEditando] = useState<UnidadMedida | null>(null);
  const [creando, setCreando] = useState(false);

  const borrar = async (u: UnidadMedida) => {
    if (!confirm(`¿Eliminar la unidad "${u.nombre}"?`)) return;
    await eliminar.mutateAsync(u.id);
  };

  return (
    <Modal titulo="Unidades de medida" abierto={abierto} tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave">
          El símbolo es lo que se muestra al lado de cada cantidad (450 <strong>kg</strong>).
        </p>

        <CargaMasiva unidades={unidades ?? []} />

        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}
        {eliminar.error && <MensajeError error={eliminar.error} />}
        {actualizar.error && <MensajeError error={actualizar.error} />}

        {unidades && unidades.length === 0 && <EstadoVacio>Todavía no hay unidades.</EstadoVacio>}

        {unidades && unidades.length > 0 && (
          <div className="tabla-scroll tabla-cards-contenedor">
            <table className="tabla tabla-cards">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Símbolo</th>
                  <th>Materiales</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id} className={u.activo ? undefined : 'fila-inactiva'}>
                    <td data-etiqueta="Unidad">
                      <strong>{u.nombre}</strong>
                    </td>
                    <td data-etiqueta="Símbolo">
                      <code>{u.simbolo}</code>
                    </td>
                    <td data-etiqueta="Materiales" className="texto-suave">
                      {u.materiales}
                    </td>
                    <td data-etiqueta="Estado">
                      {/* Desactivar es la alternativa a borrar cuando la unidad
                          ya está en uso: deja de ofrecerse, sin tocar los
                          materiales que la tienen. */}
                      <button
                        className="btn btn-chico"
                        onClick={() => actualizar.mutate({ id: u.id, activo: !u.activo })}
                      >
                        {u.activo ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="celda-acciones">
                      <AccionesFila
                        descripcion={`la unidad ${u.nombre}`}
                        onEditar={() => setEditando(u)}
                        onEliminar={() => borrar(u)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="texto-suave texto-chico">
          Una unidad que ya usan materiales no se puede eliminar: desactivala y deja de ofrecerse
          al cargar, sin cambiarle la unidad a los materiales que ya la tienen.
        </p>

        <div className="acciones">
          <button className="btn" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="btn btn-primario" onClick={() => setCreando(true)}>
            + Nueva unidad
          </button>
        </div>
      </div>

      {(creando || editando) && (
        <FormularioUnidad
          unidad={editando ?? undefined}
          alCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </Modal>
  );
}

function FormularioUnidad({ unidad, alCerrar }: { unidad?: UnidadMedida; alCerrar: () => void }) {
  const esEdicion = unidad !== undefined;
  const [nombre, setNombre] = useState(unidad?.nombre ?? '');
  const [simbolo, setSimbolo] = useState(unidad?.simbolo ?? '');
  const [orden, setOrden] = useState<number | undefined>(unidad?.orden);

  const crear = useCrearUnidad();
  const actualizar = useActualizarUnidad();
  const guardando = crear.isPending || actualizar.isPending;
  const error = crear.error ?? actualizar.error;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const datos = { nombre: nombre.trim(), simbolo: simbolo.trim(), orden: orden ?? 0 };
    if (esEdicion) {
      await actualizar.mutateAsync({ id: unidad.id, ...datos });
    } else {
      await crear.mutateAsync(datos);
    }
    alCerrar();
  };

  return (
    <Modal titulo={esEdicion ? `Editar ${unidad.nombre}` : 'Nueva unidad'} abierto onCerrar={alCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label>
          Nombre *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Kilogramo"
            autoFocus
          />
        </label>

        <label>
          Símbolo *
          <input
            value={simbolo}
            onChange={(e) => setSimbolo(e.target.value)}
            required
            maxLength={10}
            placeholder="kg"
          />
        </label>

        <label>
          Orden en el listado
          <CampoNumero valor={orden} onCambio={setOrden} min={0} placeholder="0" />
        </label>

        {error && <MensajeError error={error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear unidad'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Carga masiva de la unidad por defecto.
 *
 * Los materiales importados de los listados viejos vinieron sin unidad, y son
 * cientos: asignarlas de a una no es viable. Esto pone una por defecto y
 * después se corrigen las que hagan falta desde cada material.
 */
function CargaMasiva({ unidades }: { unidades: UnidadMedida[] }) {
  const { data: pendientes } = useMaterialesSinUnidad();
  const asignar = useAsignarUnidadMasiva();
  const [unidadId, setUnidadId] = useState('');
  const [hecho, setHecho] = useState<number | null>(null);
  const [oculto, setOculto] = useState(false);

  const sinUnidad = pendientes?.sinUnidad ?? 0;
  // Es una carga de una sola vez: una vez que no quedan materiales sin unidad,
  // el bloque no vuelve a mostrarse (la unidad es obligatoria al crear, así que
  // el hueco no se puede volver a abrir).
  if (oculto || (sinUnidad === 0 && hecho === null)) return null;

  const elegida = unidades.find((u) => u.id === unidadId);

  const aplicar = async () => {
    if (!elegida) return;
    const msg =
      `Se le va a asignar "${elegida.nombre}" a ${sinUnidad} material(es) que no tienen ` +
      'unidad. Los que ya tienen una NO se tocan. ¿Seguimos?';
    if (!confirm(msg)) return;
    const res = await asignar.mutateAsync({ unidadId });
    setHecho(res.actualizados);
  };

  return (
    <div className="alerta alerta-aviso">
      {hecho !== null ? (
        <>
          <p>
            Listo: {hecho} material(es) quedaron con la unidad asignada. Ajustá desde cada
            material los que necesiten otra. Este aviso no vuelve a aparecer.
          </p>
          <div className="acciones">
            <button className="btn" onClick={() => setOculto(true)}>
              Entendido
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Hay <strong>{sinUnidad} material(es) sin unidad</strong> (vienen así de la importación
            de los listados viejos). Podés asignarles una por defecto y corregir después los que
            necesiten otra.
          </p>
          <div className="acciones-envio">
            <select value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
              <option value="">Elegí la unidad por defecto…</option>
              {unidades
                .filter((u) => u.activo)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.simbolo})
                  </option>
                ))}
            </select>
            <button
              className="btn btn-primario"
              onClick={aplicar}
              disabled={!unidadId || asignar.isPending}
            >
              {asignar.isPending ? 'Asignando…' : `Asignar a los ${sinUnidad} sin unidad`}
            </button>
          </div>
          {asignar.error && <MensajeError error={asignar.error} />}
        </>
      )}
    </div>
  );
}
