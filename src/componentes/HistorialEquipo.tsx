import { useState } from 'react';
import { useHistorialEquipo, useRegistrarIntervencion } from '@/api/equipos';
import { useProveedores } from '@/api/proveedores';
import { useUsuarios } from '@/api/usuarios';
import { CampoNumero } from './CampoNumero';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';
import { formatearFechaSola, formatearNumero } from '@/lib/formato';
import {
  EJECUTORES,
  ETIQUETA_EJECUTOR,
  ETIQUETA_TIPO_INTERVENCION,
  TIPOS_INTERVENCION,
} from '@/tipos/equipo';
import type { Ejecutor, Equipo, RegistrarIntervencionInput, TipoIntervencion } from '@/tipos/equipo';

/**
 * Historial de intervenciones de un equipo.
 *
 * El resumen viene calculado del servidor, no acumulado en la ficha: un total
 * guardado habría que recalcularlo con cada alta, y bastaría un error para que
 * quede desfasado sin que nadie lo note.
 */
export function HistorialEquipo({ equipo }: { equipo: Equipo }) {
  const { data, isLoading, error } = useHistorialEquipo(equipo.id);
  const [registrando, setRegistrando] = useState(false);

  const deBaja = equipo.estado === 'DADO_DE_BAJA';

  return (
    <>
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">Historial</h3>
        {!deBaja && (
          <button className="btn btn-chico btn-primario" onClick={() => setRegistrando(true)}>
            + Registrar trabajo
          </button>
        )}
      </div>

      {deBaja && (
        <p className="texto-suave texto-chico">
          El equipo está dado de baja: no se le pueden registrar intervenciones nuevas. El
          historial queda como estaba.
        </p>
      )}

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}

      {data && data.resumen.cantidad > 0 && (
        <div className="resumen-mantenimiento">
          <span>
            <b>{data.resumen.cantidad}</b> trabajos
          </span>
          <span>
            <b>{data.resumen.preventivos}</b> preventivos
          </span>
          <span>
            <b>{data.resumen.correctivos}</b> correctivos
          </span>
          {data.resumen.costoTotal > 0 && (
            <span>
              <b>$ {formatearNumero(data.resumen.costoTotal)}</b> en mano de obra
            </span>
          )}
          {data.resumen.horasParadaTotal > 0 && (
            <span>
              <b>{formatearNumero(data.resumen.horasParadaTotal)}</b> h parado
            </span>
          )}
        </div>
      )}

      {data && data.intervenciones.length === 0 && (
        <EstadoVacio>
          Todavía no hay trabajos registrados. El primero que cargues empieza el historial.
        </EstadoVacio>
      )}

      {data && data.intervenciones.length > 0 && (
        <ul className="linea-tiempo">
          {data.intervenciones.map((i) => (
            <li key={i.id} className={`hito hito-${i.tipo.toLowerCase()}`}>
              <div className="hito-cabecera">
                <strong>{formatearFechaSola(i.fecha)}</strong>
                <span className={`etiqueta tipo-${i.tipo.toLowerCase()}`}>
                  {ETIQUETA_TIPO_INTERVENCION[i.tipo]}
                </span>
                <span className="texto-suave texto-chico">
                  {ETIQUETA_EJECUTOR[i.ejecutor]}
                  {i.ejecutor === 'INTERNO' && i.usuarioNombre && ` · ${i.usuarioNombre}`}
                  {i.ejecutor === 'EXTERNO' && i.proveedorNombre && ` · ${i.proveedorNombre}`}
                </span>
              </div>

              <p className="hito-descripcion">{i.descripcion}</p>

              {(i.costoManoObra !== null || i.horasParada !== null) && (
                <p className="texto-suave texto-chico">
                  {i.costoManoObra !== null && `$ ${formatearNumero(i.costoManoObra)}`}
                  {i.costoManoObra !== null && i.horasParada !== null && ' · '}
                  {i.horasParada !== null && `${formatearNumero(i.horasParada)} h parado`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {registrando && (
        <FormularioIntervencion equipo={equipo} alCerrar={() => setRegistrando(false)} />
      )}
    </>
  );
}

function FormularioIntervencion({ equipo, alCerrar }: { equipo: Equipo; alCerrar: () => void }) {
  const registrar = useRegistrarIntervencion(equipo.id);
  const { data: usuarios } = useUsuarios(1, 100);
  const { data: proveedores } = useProveedores(1, 100);

  const [form, setForm] = useState<RegistrarIntervencionInput>({
    tipo: 'CORRECTIVO',
    // Por defecto hoy: el caso normal es cargar el trabajo el mismo día.
    fecha: new Date().toISOString().slice(0, 10),
    ejecutor: 'INTERNO',
    descripcion: '',
  });

  const cambiar = (parcial: Partial<RegistrarIntervencionInput>) =>
    setForm((f) => ({ ...f, ...parcial }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await registrar.mutateAsync({
      ...form,
      descripcion: form.descripcion.trim(),
      // Se manda solo el que corresponde al ejecutor elegido.
      usuarioId: form.ejecutor === 'INTERNO' ? form.usuarioId : null,
      proveedorId: form.ejecutor === 'EXTERNO' ? form.proveedorId : null,
    });
    alCerrar();
  };

  return (
    <Modal titulo={`Registrar trabajo · ${equipo.nombre}`} abierto tamano="ancho" onCerrar={alCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <div className="fila-campos">
          <div className="campo">
            <label>Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => cambiar({ tipo: e.target.value as TipoIntervencion })}
            >
              {TIPOS_INTERVENCION.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_INTERVENCION[t]}
                </option>
              ))}
            </select>
            <span className="texto-suave texto-chico">
              Preventivo es lo planificado; correctivo es una rotura.
            </span>
          </div>

          <div className="campo">
            <label>Fecha *</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => cambiar({ fecha: e.target.value })}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>¿Quién lo hizo? *</label>
            <select
              value={form.ejecutor}
              onChange={(e) => cambiar({ ejecutor: e.target.value as Ejecutor })}
            >
              {EJECUTORES.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_EJECUTOR[e]}
                </option>
              ))}
            </select>
          </div>

          {form.ejecutor === 'INTERNO' ? (
            <div className="campo">
              <label>Persona *</label>
              <select
                value={form.usuarioId ?? ''}
                onChange={(e) => cambiar({ usuarioId: e.target.value || null })}
                required
              >
                <option value="">Elegí quién lo hizo…</option>
                {(usuarios?.datos ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="campo">
              <label>Proveedor *</label>
              <select
                value={form.proveedorId ?? ''}
                onChange={(e) => cambiar({ proveedorId: e.target.value || null })}
                required
              >
                <option value="">Elegí el proveedor…</option>
                {(proveedores?.datos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="campo">
          <label>¿Qué se hizo? *</label>
          <textarea
            rows={3}
            value={form.descripcion}
            onChange={(e) => cambiar({ descripcion: e.target.value })}
            required
            maxLength={2000}
            placeholder="Se cambió la correa y se ajustó la tensión"
            autoFocus
          />
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>Costo de mano de obra</label>
            <CampoNumero
              min={0}
              step="0.01"
              placeholder="opcional"
              valor={form.costoManoObra ?? undefined}
              onCambio={(v) => cambiar({ costoManoObra: v })}
            />
          </div>
          <div className="campo">
            <label>Horas que estuvo parado</label>
            <CampoNumero
              min={0}
              step="0.5"
              placeholder="opcional"
              valor={form.horasParada ?? undefined}
              onCambio={(v) => cambiar({ horasParada: v })}
            />
            <span className="texto-suave texto-chico">
              Lo que costó en producción, no en repuestos.
            </span>
          </div>
        </div>

        {registrar.error && <MensajeError error={registrar.error} />}

        <p className="texto-suave texto-chico">
          Una vez cargado no se edita: es el registro de algo que pasó. Si te equivocás, se
          corrige con otro trabajo que lo aclare.
        </p>

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={registrar.isPending}>
            {registrar.isPending ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
