import { useState } from 'react';
import {
  useActualizarPlan,
  useCrearPlan,
  useEliminarPlan,
  usePlanesDeEquipo,
} from '@/api/equipos';
import { AccionesFila } from './AccionesFila';
import { CampoNumero } from './CampoNumero';
import { Cargando, EstadoVacio, MensajeError } from './Estados';
import { Modal } from './Modal';
import { formatearFechaSola } from '@/lib/formato';
import { ETIQUETA_ESTADO_PLAN } from '@/tipos/equipo';
import type { CrearPlanInput, Equipo, PlanMantenimiento } from '@/tipos/equipo';

/** Cuántos días faltan, en palabras. */
export function textoVencimiento(dias: number): string {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Faltan ${dias} días`;
}

/**
 * Planes de mantenimiento de un equipo.
 *
 * El estado de cada plan (vencido, por vencer, al día) lo calcula el servidor
 * al leer. Guardarlo obligaría a recalcular todos los planes cada noche: uno al
 * día pasa a vencido solo por el paso del tiempo, sin que nadie toque nada.
 */
export function PlanesEquipo({ equipo }: { equipo: Equipo }) {
  const { data, isLoading, error } = usePlanesDeEquipo(equipo.id);
  const eliminar = useEliminarPlan(equipo.id);
  const actualizar = useActualizarPlan(equipo.id);
  const [editando, setEditando] = useState<PlanMantenimiento | null>(null);
  const [creando, setCreando] = useState(false);

  const borrar = async (plan: PlanMantenimiento) => {
    const aviso =
      `¿Eliminar el plan "${plan.nombre}"?\n\n` +
      'Los trabajos ya registrados NO se borran: el trabajo pasó, exista o no el plan. ' +
      'Si el plan dejó de usarse, conviene desactivarlo en vez de borrarlo.';
    if (!confirm(aviso)) return;
    await eliminar.mutateAsync(plan.id);
  };

  return (
    <>
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">Mantenimiento programado</h3>
        <button className="btn btn-chico btn-primario" onClick={() => setCreando(true)}>
          + Definir plan
        </button>
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}
      {actualizar.error && <MensajeError error={actualizar.error} />}

      {data && data.length === 0 && (
        <EstadoVacio>
          Sin planes. Definí uno para que el sistema avise antes de cada service en vez de
          después.
        </EstadoVacio>
      )}

      {data && data.length > 0 && (
        <ul className="lista-planes">
          {data.map((p) => (
            <li key={p.id} className={`plan plan-${p.estado.toLowerCase()} ${p.activo ? '' : 'fila-inactiva'}`}>
              <div className="plan-datos">
                <div className="hito-cabecera">
                  <strong>{p.nombre}</strong>
                  <span className={`etiqueta plan-etq-${p.estado.toLowerCase()}`}>
                    {ETIQUETA_ESTADO_PLAN[p.estado]}
                  </span>
                  {!p.activo && <span className="etiqueta etiqueta-aviso">Desactivado</span>}
                </div>

                <p className="texto-suave texto-chico">
                  Cada {p.periodicidadDias} días · próximo {formatearFechaSola(p.proximaFecha)}
                  {p.activo && ` · ${textoVencimiento(p.diasParaVencer)}`}
                </p>

                {p.tareas && <p className="hito-descripcion">{p.tareas}</p>}
              </div>

              <div className="plan-acciones">
                {/* Desactivar es la salida cuando el plan dejó de usarse pero
                    tiene trabajos registrados que lo referencian. */}
                <button
                  className="btn btn-chico"
                  onClick={() => actualizar.mutate({ planId: p.id, activo: !p.activo })}
                >
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
                <AccionesFila
                  descripcion={`el plan ${p.nombre}`}
                  onEditar={() => setEditando(p)}
                  onEliminar={() => borrar(p)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creando || editando) && (
        <FormularioPlan
          equipo={equipo}
          plan={editando ?? undefined}
          alCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </>
  );
}

/** Periodicidades habituales, para no hacer la cuenta a mano. */
const SUGERENCIAS = [
  { dias: 30, texto: 'Mensual' },
  { dias: 90, texto: 'Trimestral' },
  { dias: 180, texto: 'Semestral' },
  { dias: 365, texto: 'Anual' },
];

function FormularioPlan({
  equipo,
  plan,
  alCerrar,
}: {
  equipo: Equipo;
  plan?: PlanMantenimiento;
  alCerrar: () => void;
}) {
  const esEdicion = plan !== undefined;
  const crear = useCrearPlan(equipo.id);
  const actualizar = useActualizarPlan(equipo.id);
  const guardando = crear.isPending || actualizar.isPending;
  const error = crear.error ?? actualizar.error;

  const [form, setForm] = useState<CrearPlanInput>({
    nombre: plan?.nombre ?? '',
    tareas: plan?.tareas ?? '',
    periodicidadDias: plan?.periodicidadDias ?? 90,
    proximaFecha: plan?.proximaFecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  });

  const cambiar = (parcial: Partial<CrearPlanInput>) => setForm((f) => ({ ...f, ...parcial }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const datos = {
      nombre: form.nombre.trim(),
      tareas: form.tareas?.trim() || null,
      periodicidadDias: form.periodicidadDias,
      proximaFecha: form.proximaFecha,
    };
    if (esEdicion) await actualizar.mutateAsync({ planId: plan.id, ...datos });
    else await crear.mutateAsync(datos);
    alCerrar();
  };

  return (
    <Modal
      titulo={esEdicion ? `Editar plan · ${plan.nombre}` : `Nuevo plan · ${equipo.nombre}`}
      abierto
      tamano="ancho"
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <div className="campo">
          <label>¿Qué trabajo es? *</label>
          <input
            value={form.nombre}
            onChange={(e) => cambiar({ nombre: e.target.value })}
            required
            maxLength={120}
            placeholder="Cambio de aceite"
            autoFocus
          />
        </div>

        <div className="fila-campos">
          <div className="campo">
            <label>¿Cada cuántos días? *</label>
            <CampoNumero
              min={1}
              step="1"
              valor={form.periodicidadDias}
              onCambio={(v) => cambiar({ periodicidadDias: v ?? 1 })}
            />
            <div className="sugerencias-periodicidad">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s.dias}
                  type="button"
                  className="btn btn-chico"
                  onClick={() => cambiar({ periodicidadDias: s.dias })}
                >
                  {s.texto}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <label>¿Cuándo toca la próxima vez? *</label>
            <input
              type="date"
              value={form.proximaFecha}
              onChange={(e) => cambiar({ proximaFecha: e.target.value })}
              required
            />
            <span className="texto-suave texto-chico">
              Después se adelanta sola cada vez que registres el trabajo.
            </span>
          </div>
        </div>

        <div className="campo">
          <label>Tareas</label>
          <textarea
            rows={3}
            value={form.tareas ?? ''}
            onChange={(e) => cambiar({ tareas: e.target.value })}
            maxLength={2000}
            placeholder="Vaciar, cambiar filtro, cargar 5 lt de ISO 68"
          />
          <span className="texto-suave texto-chico">
            Lo que hay que hacer, para que no dependa de quién lo haga.
          </span>
        </div>

        {error && <MensajeError error={error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
