import { useState } from 'react';
import {
  useActualizarCredencial,
  useCrearCredencial,
  useCrearTipoCredencial,
  useTiposCredencial,
  type Credencial,
} from '@/api/credenciales';
import { P, usePuede } from '@/lib/permisos';
import { ComboEquipoIt } from './ComboEquipoIt';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import { SelectConAlta } from './SelectConAlta';

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

function formDe(c: Credencial): FormCredencial {
  return {
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
  };
}

/**
 * Cargar una credencial nueva o editar los datos de una (la contraseña no: esa
 * se cambia con «Cambiar», que deja registro).
 *
 * Se abre desde Contraseñas y desde la ficha de un equipo de informática; desde
 * la ficha llega con el equipo ya elegido, que es lo que se va a querer.
 */
export function FormularioCredencial({
  editando = null,
  equipoInicial = null,
  onCerrar,
}: {
  /** La que se edita; sin ella es una nueva. */
  editando?: Credencial | null;
  /** El equipo con que arranca una nueva. */
  equipoInicial?: { id: string; nombre: string } | null;
  onCerrar: () => void;
}) {
  const puede = usePuede();
  const puedeEditar = puede(P.CREDENCIALES_EDITAR);
  const { data: tipos } = useTiposCredencial();
  const crear = useCrearCredencial();
  const actualizar = useActualizarCredencial();
  const crearTipo = useCrearTipoCredencial();
  const [form, setForm] = useState<FormCredencial>(() =>
    editando ? formDe(editando) : { ...FORM_VACIO, equipoIt: equipoInicial },
  );
  const cerrarFormulario = onCerrar;

  const guardar = async () => {
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

  const puedeGuardar =
    form.nombre.trim().length >= 2 && (editando !== null || form.secreto.length > 0);

  return (
    <Modal
      titulo={editando ? `Editar ${editando.nombre}` : 'Nueva credencial'}
      abierto
      onCerrar={cerrarFormulario}
    >
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
    </Modal>
  );
}
