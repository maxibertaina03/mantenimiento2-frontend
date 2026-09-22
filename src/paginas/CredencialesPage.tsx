import { useEffect, useState } from 'react';
import {
  TIPOS_CREDENCIAL,
  useActualizarCredencial,
  useCredenciales,
  useCrearCredencial,
  useEliminarCredencial,
  type Credencial,
  type EstadoRotacion,
  type FiltrosCredenciales,
  type TipoCredencial,
} from '@/api/credenciales';
import {
  HistorialCredencial,
  RotarCredencial,
  VerSecreto,
} from '@/componentes/AccionesCredencial';
import { useEquipos as useEquiposIt } from '@/api/equiposIt';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';

const LIMITE = 20;

const ETIQUETA_TIPO = Object.fromEntries(TIPOS_CREDENCIAL.map((t) => [t.valor, t.etiqueta]));

/** Cómo se ve el estado de rotación en la lista. */
const ROTACION: Record<EstadoRotacion, { texto: string; clase: string }> = {
  'sin-rotacion': { texto: 'sin vencimiento', clase: 'texto-suave' },
  'al-dia': { texto: 'al día', clase: 'badge badge-ok' },
  'por-vencer': { texto: 'por vencer', clase: 'badge badge-aviso' },
  vencida: { texto: 'vencida', clase: 'badge badge-error' },
};

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short' }) : '—';

interface FormCredencial {
  nombre: string;
  tipo: TipoCredencial;
  usuario: string;
  secreto: string;
  url: string;
  notas: string;
  rotarCadaDias: string;
  /** A qué equipo de IT pertenece. Vacío es "no es de ninguno". */
  equipoItId: string;
}

const FORM_VACIO: FormCredencial = {
  nombre: '',
  tipo: 'CORREO',
  usuario: '',
  secreto: '',
  url: '',
  notas: '',
  rotarCadaDias: '',
  equipoItId: '',
};

/**
 * El baúl de credenciales.
 *
 * La contraseña no está en esta pantalla. El servidor no la manda en el
 * listado: para verla hay que pedirla, y ese pedido queda registrado. Por eso
 * la columna que se ve es «cuándo hay que cambiarla», que es lo que uno
 * necesita mirar todos los días, y no la contraseña, que se necesita de a una.
 */
export function CredencialesPage() {
  const [buscar, setBuscar] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<TipoCredencial | ''>('');
  const [rotacion, setRotacion] = useState<FiltrosCredenciales['rotacion']>('');
  const [equipoIt, setEquipoIt] = useState('');
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
    tipo,
    rotacion,
    equipoItId: equipoIt || undefined,
    mostrar: verInactivas ? 'todas' : 'activas',
  };
  const { data, isLoading, error, isFetching } = useCredenciales(pagina, LIMITE, filtros);

  const crear = useCrearCredencial();
  const actualizar = useActualizarCredencial();
  const eliminar = useEliminarCredencial();

  /**
   * El padón de equipos de IT, para el selector y el filtro.
   *
   * Son 65: entran de una y se pueden mostrar en un desplegable común. Si
   * algún día fueran cientos, esto tendría que pasar a ser un buscador.
   */
  const equiposIt = useEquiposIt(1, 200);

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
      tipo: c.tipo,
      usuario: c.usuario ?? '',
      // Vacío a propósito: la contraseña no se edita acá, se cambia rotando.
      secreto: '',
      url: c.url ?? '',
      notas: c.notas ?? '',
      rotarCadaDias: c.rotarCadaDias ? String(c.rotarCadaDias) : '',
      equipoItId: c.equipoItId ?? '',
    });
  };

  const guardar = async () => {
    if (!form) return;
    const comun = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      usuario: form.usuario.trim() || undefined,
      url: form.url.trim() || undefined,
      notas: form.notas.trim() || undefined,
      rotarCadaDias: form.rotarCadaDias ? Number(form.rotarCadaDias) : undefined,
      // `null` y no `undefined` cuando está vacío: así se puede despegar una
      // credencial del equipo al que dejó de pertenecer. `undefined` seria
      // "no lo toques", que no es lo mismo.
      equipoItId: form.equipoItId || null,
    };

    if (editando) await actualizar.mutateAsync({ id: editando.id, ...comun });
    else await crear.mutateAsync({ ...comun, secreto: form.secreto });

    setForm(null);
    setEditando(null);
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
    form !== null && form.nombre.trim().length >= 2 && (editando !== null || form.secreto.length > 0);

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Contraseñas</h1>
        <button className="btn btn-primario" onClick={abrirNueva}>
          + Nueva credencial
        </button>
      </div>

      <div className="alerta alerta-aviso">
        Las contraseñas se guardan cifradas y no aparecen en esta lista. Para ver una hay que
        pedirla, y queda registrado quién la vio.
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="🔍 Buscar por nombre, usuario o notas…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {isFetching && <span className="texto-suave">buscando…</span>}
      </div>

      <div className="fila-campos">
        <div className="campo">
          <label>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoCredencial | '');
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {TIPOS_CREDENCIAL.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label>Rotación</label>
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
        </div>

        <div className="campo">
          <label>Equipo</label>
          <select
            value={equipoIt}
            onChange={(e) => {
              setEquipoIt(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {(equiposIt.data?.datos ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigoInterno ? `${e.codigoInterno} · ` : ''}
                {e.tipoNombre ?? 'Equipo'}
                {e.responsableNombre ? ` — ${e.responsableNombre}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="filtro-check">
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

      {data && data.datos.length > 0 && (
        <div className="tabla-scroll tabla-cards-contenedor">
          <table className="tabla tabla-cards">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Usuario</th>
                <th>Hay que cambiarla</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.datos.map((c) => {
                const estado = ROTACION[c.estadoRotacion];
                return (
                  <tr key={c.id} className={c.activo ? undefined : 'inactivo'}>
                    <td data-etiqueta="Nombre">
                      {c.nombre}
                      {!c.activo && <span className="texto-suave texto-chico"> · desactivada</span>}
                      {c.equipoItNombre && (
                        <div className="texto-suave texto-chico">{c.equipoItNombre}</div>
                      )}
                    </td>
                    <td data-etiqueta="Tipo">{ETIQUETA_TIPO[c.tipo] ?? c.tipo}</td>
                    <td data-etiqueta="Usuario">{c.usuario ?? '—'}</td>
                    <td data-etiqueta="Hay que cambiarla">
                      <span className={estado.clase}>{estado.texto}</span>
                      {c.proximaRotacion && (
                        <div className="texto-suave texto-chico">
                          {fechaCorta(c.proximaRotacion)}
                        </div>
                      )}
                    </td>
                    <td className="celda-acciones">
                      <div className="fila-acciones">
                        <button className="btn btn-sm" onClick={() => setViendo(c)}>
                          👁 Ver
                        </button>
                        <button className="btn btn-sm" onClick={() => setRotando(c)}>
                          🔑 Cambiar
                        </button>
                        <button className="btn btn-sm" onClick={() => setHistorial(c)}>
                          🕘 Historial
                        </button>
                        <button className="btn btn-sm" onClick={() => abrirEdicion(c)}>
                          Editar
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            actualizar.mutate({ id: c.id, activo: !c.activo })
                          }
                        >
                          {c.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="btn btn-sm" onClick={() => borrar(c)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.datos.length === 0 && (
        <EstadoVacio>
          {busqueda || tipo || rotacion
            ? 'Ninguna credencial cumple con ese filtro.'
            : 'Todavía no hay ninguna credencial guardada.'}
        </EstadoVacio>
      )}

      {data && data.total > LIMITE && (
        <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="texto-suave">{data.total} credencial(es)</span>
          <div className="fila-acciones">
            <button
              className="btn btn-sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              ← Anterior
            </button>
            <span className="texto-suave" style={{ padding: '0 0.5rem' }}>
              Página {pagina} de {totalPaginas}
            </span>
            <button
              className="btn btn-sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      <Modal
        titulo={editando ? `Editar ${editando.nombre}` : 'Nueva credencial'}
        abierto={form !== null}
        onCerrar={() => {
          setForm(null);
          setEditando(null);
        }}
      >
        {form && (
          <div className="formulario-modal">
            <div className="campo">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                autoFocus
                placeholder="Correo administración, AnyDesk PC1, Router principal…"
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="fila-campos">
              <div className="campo">
                <label>Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCredencial })}
                >
                  {TIPOS_CREDENCIAL.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <label>Usuario o dirección</label>
                <input
                  value={form.usuario}
                  placeholder="administracion@lacteoslastres.com.ar"
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                />
              </div>
            </div>

            {!editando && (
              <div className="campo">
                <label>Contraseña *</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.secreto}
                  onChange={(e) => setForm({ ...form, secreto: e.target.value })}
                />
              </div>
            )}

            {editando && (
              <div className="alerta alerta-aviso">
                La contraseña no se edita acá. Para cambiarla usá <strong>Cambiar</strong>, que deja
                registro de cuándo se hizo.
              </div>
            )}

            <div className="fila-campos">
              <div className="campo">
                <label>Dónde se usa</label>
                <input
                  value={form.url}
                  placeholder="https://webmail…"
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>

              <div className="campo">
                <label>Cambiarla cada (días)</label>
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
              </div>
            </div>

            {/* Muchas claves son de una maquina concreta: el inicio de sesion
                de una PC, el ingreso a una grabadora. Atarlas al equipo hace
                que despues aparezcan en su ficha, que es donde alguien las va
                a buscar. Las casillas de correo no son de ninguna maquina, y
                por eso esto es opcional. */}
            <div className="campo">
              <label>Equipo de informatica</label>
              <select
                value={form.equipoItId}
                onChange={(e) => setForm({ ...form, equipoItId: e.target.value })}
              >
                <option value="">No es de ningún equipo</option>
                {(equiposIt.data?.datos ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigoInterno ? `${e.codigoInterno} · ` : ''}
                    {e.tipoNombre ?? 'Equipo'}
                    {e.marcaNombre ? ` ${e.marcaNombre}` : ''}
                    {e.modeloNombre ? ` ${e.modeloNombre}` : ''}
                    {e.responsableNombre ? ` — ${e.responsableNombre}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Notas</label>
              <textarea
                rows={3}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>

            {crear.error && <MensajeError error={crear.error} />}
            {actualizar.error && <MensajeError error={actualizar.error} />}

            <div className="acciones">
              <button
                className="btn"
                onClick={() => {
                  setForm(null);
                  setEditando(null);
                }}
              >
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
