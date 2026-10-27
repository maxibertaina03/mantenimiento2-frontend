import {
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  KeyRound,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useActualizarCredencial,
  useCredenciales,
  useCrearCredencial,
  useCrearTipoCredencial,
  useEliminarCredencial,
  useTiposCredencial,
  type Credencial,
  type EstadoRotacion,
  type FiltrosCredenciales,
} from '@/api/credenciales';
import { HistorialCredencial, RotarCredencial, VerSecreto } from '@/componentes/AccionesCredencial';
import { ComboEquipoIt } from '@/componentes/ComboEquipoIt';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { MenuDesplegable } from '@/componentes/MenuDesplegable';
import { Modal } from '@/componentes/Modal';
import { SelectConAlta } from '@/componentes/SelectConAlta';
import { P, usePuede } from '@/lib/permisos';

const LIMITE = 20;

/** Cómo se ve el estado de rotación. */
const ROTACION: Record<EstadoRotacion, { texto: string; clase: string }> = {
  'sin-rotacion': { texto: 'sin vencimiento', clase: 'badge' },
  'al-dia': { texto: 'al día', clase: 'badge badge-ok' },
  'por-vencer': { texto: 'por vencer', clase: 'badge badge-aviso' },
  vencida: { texto: 'vencida', clase: 'badge badge-error' },
};

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short' }) : '—';

/** Si «dónde se usa» es una dirección web, se puede abrir. */
const esEnlace = (url: string) => /^https?:\/\//i.test(url);

interface FormCredencial {
  nombre: string;
  tipoId: string;
  usuario: string;
  secreto: string;
  url: string;
  notas: string;
  rotarCadaDias: string;
  /** A qué equipo de IT pertenece. `null` es «no es de ninguno». */
  equipoIt: { id: string; nombre: string } | null;
}

const FORM_VACIO: FormCredencial = {
  nombre: '',
  tipoId: '',
  usuario: '',
  secreto: '',
  url: '',
  notas: '',
  rotarCadaDias: '',
  equipoIt: null,
};

/**
 * El baúl de credenciales.
 *
 * La contraseña no está en esta pantalla. El servidor no la manda en el
 * listado: para verla hay que pedirla, y ese pedido queda registrado. Lo que se
 * ve de cada una es lo que hace falta para encontrarla y usarla: el usuario,
 * dónde se usa, de qué equipo es, las notas y cuándo hay que cambiarla.
 */
export function CredencialesPage() {
  const puede = usePuede();
  const puedeEditar = puede(P.CREDENCIALES_EDITAR);
  const [buscar, setBuscar] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [rotacion, setRotacion] = useState<FiltrosCredenciales['rotacion']>('');
  const [equipoIt, setEquipoIt] = useState<{ id: string; nombre: string } | null>(null);
  const [verInactivas, setVerInactivas] = useState(false);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(buscar);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const filtros: FiltrosCredenciales = {
    buscar: busqueda,
    tipoId: tipoId || undefined,
    rotacion,
    equipoItId: equipoIt?.id,
    mostrar: verInactivas ? 'todas' : 'activas',
  };
  const { data, isLoading, error, isFetching } = useCredenciales(pagina, LIMITE, filtros);
  const { data: tipos } = useTiposCredencial();

  const crear = useCrearCredencial();
  const actualizar = useActualizarCredencial();
  const eliminar = useEliminarCredencial();
  const crearTipo = useCrearTipoCredencial();

  const [form, setForm] = useState<FormCredencial | null>(null);
  const [editando, setEditando] = useState<Credencial | null>(null);
  const [viendo, setViendo] = useState<Credencial | null>(null);
  const [rotando, setRotando] = useState<Credencial | null>(null);
  const [historial, setHistorial] = useState<Credencial | null>(null);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / LIMITE)) : 1;

  const abrirNueva = () => {
    setEditando(null);
    setForm(FORM_VACIO);
  };

  const abrirEdicion = (c: Credencial) => {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      tipoId: c.tipoId ?? '',
      usuario: c.usuario ?? '',
      // Vacío a propósito: la contraseña no se edita acá, se cambia rotando.
      secreto: '',
      url: c.url ?? '',
      notas: c.notas ?? '',
      rotarCadaDias: c.rotarCadaDias ? String(c.rotarCadaDias) : '',
      equipoIt:
        c.equipoItId !== null ? { id: c.equipoItId, nombre: c.equipoItNombre ?? 'Equipo' } : null,
    });
  };

  const cerrarFormulario = () => {
    setForm(null);
    setEditando(null);
  };

  const guardar = async () => {
    if (!form) return;
    const comun = {
      nombre: form.nombre.trim(),
      // `null` y no `undefined` cuando está vacío: así se puede sacar el tipo
      // o despegar una credencial del equipo al que dejó de pertenecer.
      tipoId: form.tipoId || null,
      usuario: form.usuario.trim() || undefined,
      url: form.url.trim() || undefined,
      notas: form.notas.trim() || undefined,
      rotarCadaDias: form.rotarCadaDias ? Number(form.rotarCadaDias) : undefined,
      equipoItId: form.equipoIt?.id ?? null,
    };

    if (editando) await actualizar.mutateAsync({ id: editando.id, ...comun });
    else await crear.mutateAsync({ ...comun, secreto: form.secreto });
    cerrarFormulario();
  };

  const borrar = async (c: Credencial) => {
    if (
      !confirm(
        `¿Borrar "${c.nombre}" y todo su historial?\n\n` +
          'Si solo dejaste de usarla, conviene desactivarla: así se conserva el registro de quién vio qué.',
      )
    )
      return;
    await eliminar.mutateAsync(c.id);
  };

  const puedeGuardar =
    form !== null &&
    form.nombre.trim().length >= 2 &&
    (editando !== null || form.secreto.length > 0);

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Contraseñas</h1>
          <p className="texto-suave">
            Se guardan cifradas. Para ver una hay que pedirla, y queda registrado quién la vio.
          </p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primario" onClick={abrirNueva}>
            <Plus className="icono" aria-hidden />
            Nueva credencial
          </button>
        )}
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar por nombre, usuario o notas…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      <div className="filtros-credenciales">
        <label className="campo">
          Tipo
          <select
            value={tipoId}
            onChange={(e) => {
              setTipoId(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {(tipos ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Rotación
          <select
            value={rotacion}
            onChange={(e) => {
              setRotacion(e.target.value as FiltrosCredenciales['rotacion']);
              setPagina(1);
            }}
          >
            <option value="">Todas</option>
            <option value="pendiente">Hay que cambiarlas</option>
            <option value="vencida">Vencidas</option>
            <option value="por-vencer">Vencen esta semana</option>
          </select>
        </label>

        <div className="campo">
          <span>Equipo de informática</span>
          <ComboEquipoIt
            onCambio={(e) => {
              setEquipoIt(e);
              setPagina(1);
            }}
          />
        </div>
      </div>

      <label className="casilla">
        <input
          type="checkbox"
          checked={verInactivas}
          onChange={(e) => {
            setVerInactivas(e.target.checked);
            setPagina(1);
          }}
        />
        Mostrar también las desactivadas
      </label>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {eliminar.error && <MensajeError error={eliminar.error} />}
      {actualizar.error && !form && <MensajeError error={actualizar.error} />}

      {data && data.datos.length > 0 && (
        <ul className="lista-credenciales">
          {data.datos.map((c) => {
            const estado = ROTACION[c.estadoRotacion];
            return (
              <li key={c.id} className={`panel tarjeta-credencial ${c.activo ? '' : 'inactiva'}`}>
                <div className="tarjeta-credencial-cabecera">
                  <span className="tarjeta-credencial-icono" aria-hidden>
                    <KeyRound />
                  </span>
                  <div className="tarjeta-credencial-titulo">
                    <strong>{c.nombre}</strong>
                    <span className="tarjeta-credencial-etiquetas">
                      {c.tipoNombre && <span className="badge">{c.tipoNombre}</span>}
                      {!c.activo && <span className="badge badge-error">desactivada</span>}
                    </span>
                  </div>
                  <span className="tarjeta-credencial-rotacion">
                    <span className={estado.clase}>{estado.texto}</span>
                    {c.proximaRotacion && (
                      <span className="texto-suave texto-chico">
                        cambiarla el {fechaCorta(c.proximaRotacion)}
                      </span>
                    )}
                  </span>
                </div>

                <dl className="tarjeta-credencial-datos">
                  <div>
                    <dt>Usuario</dt>
                    <dd>{c.usuario ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Dónde se usa</dt>
                    <dd>
                      {c.url ? (
                        esEnlace(c.url) ? (
                          <a href={c.url} target="_blank" rel="noreferrer noopener">
                            {c.url}
                          </a>
                        ) : (
                          c.url
                        )
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  {c.equipoItNombre && (
                    <div>
                      <dt>Equipo</dt>
                      <dd className="con-icono">
                        <Monitor className="icono" aria-hidden />
                        {c.equipoItNombre}
                      </dd>
                    </div>
                  )}
                </dl>

                {c.notas && (
                  <p className="tarjeta-credencial-notas">
                    <StickyNote className="icono" aria-hidden />
                    <span>{c.notas}</span>
                  </p>
                )}

                <div className="tarjeta-credencial-acciones">
                  <button className="btn btn-sm btn-primario" onClick={() => setViendo(c)}>
                    <Eye className="icono" aria-hidden />
                    Ver
                  </button>
                  {puedeEditar && (
                    <button className="btn btn-sm" onClick={() => setRotando(c)}>
                      <KeyRound className="icono" aria-hidden />
                      Cambiar
                    </button>
                  )}
                  <MenuDesplegable
                    texto="Más"
                    Icono={MoreHorizontal}
                    opciones={[
                      { texto: 'Historial', Icono: History, onElegir: () => setHistorial(c) },
                      ...(puedeEditar
                        ? [
                            { texto: 'Editar', Icono: Pencil, onElegir: () => abrirEdicion(c) },
                            {
                              texto: c.activo ? 'Desactivar' : 'Activar',
                              Icono: Power,
                              onElegir: () => actualizar.mutate({ id: c.id, activo: !c.activo }),
                            },
                            { texto: 'Eliminar', Icono: Trash2, onElegir: () => void borrar(c) },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busqueda || tipoId || rotacion || equipoIt
            ? 'Ninguna credencial cumple con ese filtro.'
            : 'Todavía no hay ninguna credencial guardada.'}
        </EstadoVacio>
      )}

      {data && data.total > LIMITE && (
        <div className="paginacion">
          <span className="texto-suave">{data.total} credenciales</span>
          <div className="fila-acciones">
            <button
              className="btn btn-sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              <ChevronLeft className="icono" aria-hidden />
              Anterior
            </button>
            <span className="texto-suave">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              className="btn btn-sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
              <ChevronRight className="icono" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <Modal
        titulo={editando ? `Editar ${editando.nombre}` : 'Nueva credencial'}
        abierto={form !== null}
        onCerrar={cerrarFormulario}
      >
        {form && (
          <div className="formulario-modal">
            <label className="campo">
              Nombre *
              <input
                value={form.nombre}
                autoFocus
                placeholder="Correo administración, AnyDesk PC1, Router principal…"
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </label>

            <div className="fila-campos">
              <div className="campo">
                <span>Tipo</span>
                <SelectConAlta
                  etiqueta="Tipo"
                  masculino
                  valor={form.tipoId}
                  opciones={tipos ?? []}
                  vacio="Sin tipo"
                  textoAgregar="+ Agregar tipo…"
                  puedeAgregar={puedeEditar}
                  onCambio={(id) => setForm({ ...form, tipoId: id })}
                  onAgregar={async (nombre) => (await crearTipo.mutateAsync(nombre)).id}
                />
              </div>

              <label className="campo">
                Usuario o dirección
                <input
                  value={form.usuario}
                  placeholder="administracion@lacteoslastres.com.ar"
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                />
              </label>
            </div>

            {!editando && (
              <label className="campo">
                Contraseña *
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.secreto}
                  onChange={(e) => setForm({ ...form, secreto: e.target.value })}
                />
              </label>
            )}

            {editando && (
              <div className="alerta alerta-aviso">
                La contraseña no se edita acá. Para cambiarla usá <strong>Cambiar</strong>, que deja
                registro de cuándo se hizo.
              </div>
            )}

            <div className="fila-campos">
              <label className="campo">
                Dónde se usa
                <input
                  value={form.url}
                  placeholder="https://webmail…"
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </label>

              <label className="campo">
                Cambiarla cada (días)
                <input
                  type="number"
                  min={1}
                  value={form.rotarCadaDias}
                  placeholder="90"
                  onChange={(e) => setForm({ ...form, rotarCadaDias: e.target.value })}
                />
                <span className="texto-suave texto-chico">
                  Vacío es sin vencimiento. No todo acceso necesita cambiarse.
                </span>
              </label>
            </div>

            {/* Muchas claves son de una máquina concreta: el inicio de sesión de
                una PC, el ingreso a una grabadora. Atarlas al equipo hace que
                después aparezcan en su ficha, que es donde alguien las va a
                buscar. Las casillas de correo no son de ninguna máquina, y por
                eso es opcional. */}
            <div className="campo">
              <span>Equipo de informática (opcional)</span>
              <ComboEquipoIt
                inicial={form.equipoIt}
                onCambio={(e) => setForm({ ...form, equipoIt: e })}
              />
              <span className="texto-suave texto-chico">
                Buscalo por código, marca o modelo, o escaneá su etiqueta. Vacío: no es de ningún
                equipo.
              </span>
            </div>

            <label className="campo">
              Notas
              <textarea
                rows={3}
                value={form.notas}
                placeholder="Para qué es, quién la usa, cualquier dato para no tener que preguntar"
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </label>

            {crear.error && <MensajeError error={crear.error} />}
            {actualizar.error && <MensajeError error={actualizar.error} />}

            <div className="acciones">
              <button className="btn" onClick={cerrarFormulario}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                onClick={guardar}
                disabled={!puedeGuardar || crear.isPending || actualizar.isPending}
              >
                {crear.isPending || actualizar.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {viendo && <VerSecreto credencial={viendo} onCerrar={() => setViendo(null)} />}
      {rotando && <RotarCredencial credencial={rotando} onCerrar={() => setRotando(null)} />}
      {historial && (
        <HistorialCredencial credencial={historial} onCerrar={() => setHistorial(null)} />
      )}
    </>
  );
}
