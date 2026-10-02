import { useState } from 'react';
import { useModelosDeMarca, useCatalogoEquipos } from '@/api/catalogosEquipo';
import { useActualizarEquipo, useCrearEquipo } from '@/api/equipos';
import { ETIQUETA_ESTADO_EQUIPO, TRANSICIONES_ESTADO } from '@/tipos/equipo';
import type { CrearEquipoInput, Equipo, EstadoEquipo } from '@/tipos/equipo';
import {
  CLASIFICACIONES_EQUIPO,
  ETIQUETA_CLASIFICACION,
  type ClasificacionEquipo,
} from '@/tipos/ordenCompra';
import { CampoNumero } from './CampoNumero';
import { MensajeError } from './Estados';
import { Modal } from './Modal';

export function FormularioEquipo({ equipo, alCerrar }: { equipo?: Equipo; alCerrar: () => void }) {
  const esEdicion = equipo !== undefined;
  const { ubicaciones, tipos, marcas } = useCatalogoEquipos();
  const crear = useCrearEquipo();
  const actualizar = useActualizarEquipo();
  const guardando = crear.isPending || actualizar.isPending;
  const error = crear.error ?? actualizar.error;

  const [form, setForm] = useState<CrearEquipoInput & { estado?: EstadoEquipo }>({
    nombre: equipo?.nombre ?? '',
    codigoInterno: equipo?.codigoInterno ?? '',
    descripcion: equipo?.descripcion ?? '',
    marcaId: equipo?.marcaId ?? '',
    modeloId: equipo?.modeloId ?? '',
    numeroSerie: equipo?.numeroSerie ?? '',
    ubicacionId: equipo?.ubicacionId ?? '',
    tipoId: equipo?.tipoId ?? '',
    horasUso: equipo?.horasUso ?? undefined,
    fechaAlta: equipo?.fechaAlta?.slice(0, 10) ?? '',
    garantiaHasta: equipo?.garantiaHasta?.slice(0, 10) ?? '',
    estado: equipo?.estado,
    clasificacion: equipo?.clasificacion ?? 'EQUIPO',
  });

  const cambiar = (parcial: Partial<typeof form>) => setForm((f) => ({ ...f, ...parcial }));

  // Los modelos de la marca elegida. Sin marca no se pide nada: la lista de
  // todos los modelos de todas las marcas no le sirve a nadie.
  const modelos = useModelosDeMarca(form.marcaId);

  // Los campos vacíos viajan como null (borrar) y no como "": el backend
  // normaliza igual, pero mandar "" ensucia el cuerpo de la request.
  const oNull = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const datos = {
      nombre: form.nombre.trim(),
      codigoInterno: oNull(form.codigoInterno),
      descripcion: oNull(form.descripcion),
      marcaId: oNull(form.marcaId),
      modeloId: oNull(form.modeloId),
      numeroSerie: oNull(form.numeroSerie),
      ubicacionId: oNull(form.ubicacionId),
      tipoId: oNull(form.tipoId),
      horasUso: form.horasUso ?? null,
      fechaAlta: oNull(form.fechaAlta),
      garantiaHasta: oNull(form.garantiaHasta),
    };

    if (esEdicion) {
      await actualizar.mutateAsync({ id: equipo.id, ...datos, estado: form.estado });
    } else {
      await crear.mutateAsync(datos);
    }
    alCerrar();
  };

  // Solo los estados a los que se puede llegar desde el actual: el backend
  // rechaza el resto, y ofrecerlos sería prometer algo que no se cumple.
  const estadosPosibles = equipo
    ? [equipo.estado, ...TRANSICIONES_ESTADO[equipo.estado]]
    : ([] as EstadoEquipo[]);

  return (
    <Modal
      titulo={esEdicion ? `Editar ${equipo.nombre}` : 'Nuevo equipo'}
      abierto
      tamano="ancho"
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <div className="fila-campos">
          <div className="campo">
            <label>Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => cambiar({ nombre: e.target.value })}
              required
              maxLength={120}
              autoFocus
              placeholder="Compresor 1"
            />
          </div>

          <div className="campo">
            <label htmlFor="equipo-clasificacion">Qué es</label>
            {/* Una categoria por encima del tipo: una prensa es un EQUIPO de
                tipo "Prensa"; una amoladora es una HERRAMIENTA. Las
                herramientas chicas y de consumo van al paniol como material. */}
            <select
              id="equipo-clasificacion"
              value={form.clasificacion}
              onChange={(e) => cambiar({ clasificacion: e.target.value as ClasificacionEquipo })}
            >
              {CLASIFICACIONES_EQUIPO.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CLASIFICACION[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Código interno</label>
            <input
              value={form.codigoInterno ?? ''}
              onChange={(e) => cambiar({ codigoInterno: e.target.value })}
              maxLength={40}
              placeholder="COMP-01"
            />
          </div>
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Ubicación</label>
            <select
              value={form.ubicacionId ?? ''}
              onChange={(e) => cambiar({ ubicacionId: e.target.value })}
            >
              <option value="">Sin ubicación</option>
              {(ubicaciones.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select value={form.tipoId ?? ''} onChange={(e) => cambiar({ tipoId: e.target.value })}>
              <option value="">Sin tipo</option>
              {(tipos.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fila-campos">
          {esEdicion && (
            <div className="campo">
              <label>Estado</label>
              <select
                value={form.estado ?? equipo.estado}
                onChange={(e) => cambiar({ estado: e.target.value as EstadoEquipo })}
              >
                {estadosPosibles.map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_ESTADO_EQUIPO[e]}
                  </option>
                ))}
              </select>
              {equipo.estado === 'DADO_DE_BAJA' && (
                <span className="texto-suave texto-chico">
                  Un equipo dado de baja no vuelve a otro estado.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Marca</label>
            <select
              value={form.marcaId ?? ''}
              onChange={(e) =>
                // Cambiar de marca vacía el modelo: el que estaba elegido
                // pertenece a la marca anterior y no existe en la nueva.
                cambiar({ marcaId: e.target.value, modeloId: '' })
              }
            >
              <option value="">Sin marca</option>
              {(marcas.data ?? [])
                .filter((m) => m.activo || m.id === form.marcaId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div className="campo">
            <label>Modelo</label>
            <select
              value={form.modeloId ?? ''}
              disabled={!form.marcaId}
              title={form.marcaId ? undefined : 'Elegí primero la marca'}
              onChange={(e) => cambiar({ modeloId: e.target.value })}
            >
              <option value="">{form.marcaId ? 'Sin modelo' : 'Elegí la marca'}</option>
              {(modelos.data ?? [])
                .filter((m) => m.activo || m.id === form.modeloId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div className="campo">
            <label>N° de serie</label>
            <input
              value={form.numeroSerie ?? ''}
              onChange={(e) => cambiar({ numeroSerie: e.target.value })}
            />
          </div>
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Horas de uso</label>
            <CampoNumero
              min={0}
              step="0.1"
              placeholder="opcional"
              valor={form.horasUso ?? undefined}
              onCambio={(v) => cambiar({ horasUso: v })}
            />
          </div>
          <div className="campo">
            <label>Fecha de alta</label>
            <input
              type="date"
              value={form.fechaAlta ?? ''}
              onChange={(e) => cambiar({ fechaAlta: e.target.value })}
            />
          </div>
          <div className="campo">
            <label>Garantía hasta</label>
            <input
              type="date"
              value={form.garantiaHasta ?? ''}
              onChange={(e) => cambiar({ garantiaHasta: e.target.value })}
            />
          </div>
        </div>

        <div className="campo">
          <label>Descripción</label>
          <textarea
            rows={3}
            value={form.descripcion ?? ''}
            onChange={(e) => cambiar({ descripcion: e.target.value })}
            placeholder="Para qué se usa, particularidades, dónde está exactamente…"
          />
        </div>

        {error && <MensajeError error={error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
