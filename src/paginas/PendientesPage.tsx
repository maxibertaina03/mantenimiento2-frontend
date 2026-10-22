import { ChevronDown, Factory, Pencil, Plus, RotateCcw, Trash2, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  useAnotarPendiente,
  useBorrarPendiente,
  useEditarPendiente,
  useMarcarHecho,
  usePendientes,
  usePersonasDePendientes,
  useReabrirPendiente,
} from '@/api/pendientes';
import { useUsuarioActual } from '@/api/usuarios';
import { ComboEquipo } from '@/componentes/ComboEquipo';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { P, usePuede } from '@/lib/permisos';
import type { Pendiente } from '@/tipos/pendiente';

type Filtro = 'todos' | 'mios' | 'urgentes';

/** «hoy», «ayer», «hace 3 días». */
function haceCuanto(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/**
 * El anotador de pendientes de mantenimiento: lo que quedó por hacer
 * («comprar tal cosa», «mandar a reparar tal otra»), a la vista de todos.
 *
 * Tiene que ser más rápido que un papel, o se termina usando el papel: se
 * escribe y Enter. Lo demás —urgente, a quién le toca, el equipo— es opcional.
 */
export function PendientesPage() {
  const puede = usePuede();
  const puedeEditar = puede(P.PENDIENTES_EDITAR);
  const { data: yo } = useUsuarioActual();
  const { data: abiertos, isLoading, error } = usePendientes('abiertos');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [verHechos, setVerHechos] = useState(false);
  const [editando, setEditando] = useState<Pendiente | null>(null);

  const marcar = useMarcarHecho();
  const borrar = useBorrarPendiente();

  const lista = (abiertos ?? []).filter((p) =>
    filtro === 'urgentes' ? p.urgente : filtro === 'mios' ? p.asignadoAId === yo?.id : true,
  );
  const urgentes = (abiertos ?? []).filter((p) => p.urgente).length;
  const mios = (abiertos ?? []).filter((p) => yo && p.asignadoAId === yo.id).length;
  const esAdmin = yo?.rol === 'ADMIN' || !yo;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Pendientes</h1>
          <p>
            Lo que quedó por hacer: comprar, mandar a reparar, avisar. Lo ve todo mantenimiento.
          </p>
        </div>
      </div>

      {puedeEditar && <AnotarPendiente />}

      <div className="grilla-filtros" role="group" aria-label="Qué pendientes ver">
        {(
          [
            ['todos', `Todos · ${abiertos?.length ?? 0}`],
            ['mios', `Míos · ${mios}`],
            ['urgentes', `Urgentes · ${urgentes}`],
          ] as const
        ).map(([valor, texto]) => (
          <label className="casilla" key={valor}>
            <input
              type="radio"
              name="filtro-pendientes"
              checked={filtro === valor}
              onChange={() => setFiltro(valor)}
            />
            {texto}
          </label>
        ))}
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {marcar.error && <MensajeError error={marcar.error} />}
      {borrar.error && <MensajeError error={borrar.error} />}

      {abiertos && lista.length === 0 && (
        <EstadoVacio>
          {filtro === 'todos'
            ? 'No hay nada pendiente. Lo que quede por hacer, anotalo arriba.'
            : filtro === 'mios'
              ? 'No tenés pendientes a tu nombre.'
              : 'No hay pendientes urgentes.'}
        </EstadoVacio>
      )}

      {lista.length > 0 && (
        <ul className="panel panel-lista lista-pendientes">
          {lista.map((p) => (
            <li key={p.id} className={`fila-pendiente ${p.urgente ? 'urgente' : ''}`}>
              {puedeEditar && (
                <button
                  type="button"
                  className="tilde-pendiente"
                  aria-label={`Marcar como hecho: ${p.texto}`}
                  title="Marcar como hecho"
                  disabled={marcar.isPending}
                  onClick={() => marcar.mutate(p.id)}
                />
              )}
              <div className="pendiente-cuerpo">
                <span className="pendiente-texto">{p.texto}</span>
                <span className="pendiente-datos">
                  {p.urgente && <span className="badge badge-error">Urgente</span>}
                  {p.asignadoANombre && (
                    <span className="pendiente-dato">
                      <User className="icono" aria-hidden />
                      {p.asignadoANombre}
                    </span>
                  )}
                  {p.equipoId && p.equipoNombre && (
                    <Link className="pendiente-dato" to={`/equipos/${p.equipoId}`}>
                      <Factory className="icono" aria-hidden />
                      {p.equipoNombre}
                    </Link>
                  )}
                  <span className="texto-suave texto-chico">
                    {p.creadoPorNombre ? `${p.creadoPorNombre}, ` : ''}
                    {haceCuanto(p.creadoEn)}
                  </span>
                </span>
              </div>
              {puedeEditar && (
                <div className="acciones-fila">
                  <button
                    type="button"
                    className="btn btn-icono"
                    aria-label={`Editar ${p.texto}`}
                    title="Editar"
                    onClick={() => setEditando(p)}
                  >
                    <Pencil className="icono" aria-hidden />
                  </button>
                  {(esAdmin || p.creadoPorId === yo?.id) && (
                    <button
                      type="button"
                      className="btn btn-icono btn-icono-peligro"
                      aria-label={`Borrar ${p.texto}`}
                      title="Borrar"
                      onClick={() => {
                        if (confirm(`¿Borrar «${p.texto}»? Si ya se hizo, mejor tildalo.`)) {
                          borrar.mutate(p.id);
                        }
                      }}
                    >
                      <Trash2 className="icono" aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="hechos-pendientes">
        <button
          type="button"
          className="btn btn-fantasma"
          aria-expanded={verHechos}
          onClick={() => setVerHechos((v) => !v)}
        >
          <ChevronDown className={`icono flecha-grupo ${verHechos ? 'abierta' : ''}`} />
          Hechos en los últimos 60 días
        </button>
        {verHechos && <PendientesHechos puedeEditar={puedeEditar} />}
      </section>

      {editando && <EditarPendiente pendiente={editando} onCerrar={() => setEditando(null)} />}
    </>
  );
}

/** El campo de arriba: se escribe y Enter. Lo opcional, en «Más». */
function AnotarPendiente() {
  const anotar = useAnotarPendiente();
  const [texto, setTexto] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [mas, setMas] = useState(false);
  const [asignadoAId, setAsignadoAId] = useState('');
  const [equipo, setEquipo] = useState<{ id: string; nombre: string } | null>(null);
  // Para limpiar el combo de equipo después de anotar: se vuelve a montar.
  const [vuelta, setVuelta] = useState(0);
  const { data: personas } = usePersonasDePendientes(mas);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    anotar.mutate(
      { texto, urgente, asignadoAId: asignadoAId || null, equipoId: equipo?.id ?? null },
      {
        onSuccess: () => {
          setTexto('');
          setUrgente(false);
          setAsignadoAId('');
          setEquipo(null);
          setVuelta((v) => v + 1);
        },
      },
    );
  };

  return (
    <form className="panel anotador" onSubmit={enviar}>
      <div className="anotador-linea">
        <input
          type="text"
          aria-label="Qué quedó pendiente"
          placeholder="Anotar algo pendiente… (Enter para guardar)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={500}
        />
        <button
          type="submit"
          className="btn btn-primario"
          disabled={anotar.isPending || !texto.trim()}
        >
          <Plus className="icono" aria-hidden />
          Anotar
        </button>
      </div>
      <div className="anotador-opciones">
        <label className="casilla">
          <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
          Urgente
        </label>
        <button
          type="button"
          className="btn btn-fantasma btn-sm"
          aria-expanded={mas}
          onClick={() => setMas((v) => !v)}
        >
          <ChevronDown className={`icono flecha-grupo ${mas ? 'abierta' : ''}`} />
          {mas ? 'Menos' : 'A quién le toca, equipo'}
        </button>
      </div>
      {mas && (
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="pendiente-persona">A quién le toca</label>
            <select
              id="pendiente-persona"
              value={asignadoAId}
              onChange={(e) => setAsignadoAId(e.target.value)}
            >
              <option value="">A cualquiera</option>
              {(personas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Equipo (opcional)</label>
            <ComboEquipo key={vuelta} onCambio={setEquipo} />
          </div>
        </div>
      )}
      {anotar.error && <MensajeError error={anotar.error} />}
    </form>
  );
}

/** Lo hecho en los últimos 60 días, con la opción de reabrirlo. */
function PendientesHechos({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, isLoading, error } = usePendientes('hechos');
  const reabrir = useReabrirPendiente();
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  if (!data || data.length === 0) {
    return <EstadoVacio>No se terminó ningún pendiente en los últimos 60 días.</EstadoVacio>;
  }
  return (
    <ul className="panel panel-lista lista-pendientes">
      {data.map((p) => (
        <li key={p.id} className="fila-pendiente hecho">
          <span className="tilde-pendiente tildado" aria-hidden />
          <div className="pendiente-cuerpo">
            <span className="pendiente-texto">{p.texto}</span>
            <span className="texto-suave texto-chico">
              Hecho {p.hechaEn ? haceCuanto(p.hechaEn) : ''}
              {p.hechaPorNombre ? ` por ${p.hechaPorNombre}` : ''}
            </span>
          </div>
          {puedeEditar && (
            <button
              type="button"
              className="btn btn-fantasma btn-sm"
              disabled={reabrir.isPending}
              onClick={() => reabrir.mutate(p.id)}
            >
              <RotateCcw className="icono" aria-hidden />
              Reabrir
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function EditarPendiente({ pendiente, onCerrar }: { pendiente: Pendiente; onCerrar: () => void }) {
  const editar = useEditarPendiente();
  const { data: personas } = usePersonasDePendientes();
  const [texto, setTexto] = useState(pendiente.texto);
  const [urgente, setUrgente] = useState(pendiente.urgente);
  const [asignadoAId, setAsignadoAId] = useState(pendiente.asignadoAId ?? '');
  const [equipoId, setEquipoId] = useState<string | null>(pendiente.equipoId);

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    editar.mutate(
      { id: pendiente.id, texto, urgente, asignadoAId: asignadoAId || null, equipoId },
      { onSuccess: onCerrar },
    );
  };

  return (
    <Modal titulo="Editar pendiente" abierto onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar}>
        <label>
          Qué quedó pendiente
          <textarea
            rows={3}
            value={texto}
            maxLength={500}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <label className="casilla">
          <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
          Urgente
        </label>
        <label>
          A quién le toca
          <select value={asignadoAId} onChange={(e) => setAsignadoAId(e.target.value)}>
            <option value="">A cualquiera</option>
            {(personas ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="campo">
          <label>Equipo (opcional)</label>
          <ComboEquipo
            inicial={
              pendiente.equipoId && pendiente.equipoNombre
                ? { id: pendiente.equipoId, nombre: pendiente.equipoNombre }
                : null
            }
            onCambio={(e) => setEquipoId(e?.id ?? null)}
          />
        </div>
        {editar.error && <MensajeError error={editar.error} />}
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={editar.isPending}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
