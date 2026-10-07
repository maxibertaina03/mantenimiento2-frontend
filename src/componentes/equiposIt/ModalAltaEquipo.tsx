import { useEffect, useState } from 'react';
import { useActualizarEquipo, useCrearEquipo, useTiposEquipo } from '@/api/equiposIt';
import {
  useCatalogoIt,
  useCrearItemCatalogo,
  useCrearModelo,
  useModelosDeMarca,
} from '@/api/catalogosEquipo';
import { SelectorCatalogo } from '@/componentes/SelectorCatalogo';
import { MensajeError } from '@/componentes/Estados';
import { CampoNumero } from '@/componentes/CampoNumero';
import { Modal } from '@/componentes/Modal';
import { ETIQUETA_ACCESO, ETIQUETA_ESTADO } from '@/tipos/equipoIt';
import type { CrearEquipoInput, EquipoIt, EstadoEquipoIt } from '@/tipos/equipoIt';
import { ESTADOS, nombreDelEquipo } from './comun';

/** El tipo se completa con el primero del catálogo al abrir el formulario. */
const FORMULARIO_VACIO: CrearEquipoInput = {
  tipoId: '',
};

/** Toma del equipo solo los campos que el formulario edita. */
function aFormulario(equipo: EquipoIt): CrearEquipoInput {
  return {
    codigoInterno: equipo.codigoInterno ?? undefined,
    tipoId: equipo.tipoId,
    estado: equipo.estado,
    marcaId: equipo.marcaId ?? undefined,
    modeloId: equipo.modeloId ?? undefined,
    numeroSerie: equipo.numeroSerie ?? undefined,
    procesador: equipo.procesador ?? undefined,
    memoriaRamGb: equipo.memoriaRamGb ?? undefined,
    discoTipo: equipo.discoTipo ?? undefined,
    discoCapacidadGb: equipo.discoCapacidadGb ?? undefined,
    sistemaOperativo: equipo.sistemaOperativo ?? undefined,
    direccionIp: equipo.direccionIp ?? undefined,
    direccionMac: equipo.direccionMac ?? undefined,
    nombreEnRed: equipo.nombreEnRed ?? undefined,
    accesoRemoto: equipo.accesoRemoto,
    accesoRemotoId: equipo.accesoRemotoId ?? undefined,
    ubicacionId: equipo.ubicacionId ?? undefined,
    proveedorId: equipo.proveedorId ?? undefined,
    fechaCompra: equipo.fechaCompra ?? undefined,
    garantiaHasta: equipo.garantiaHasta ?? undefined,
    notas: equipo.notas ?? undefined,
  };
}

/**
 * Mismo formulario para dar de alta y para editar: los campos son los mismos y
 * mantener dos copias garantizaba que se desincronizaran.
 */
export function ModalAltaEquipo({
  alCerrar,
  equipo,
}: {
  alCerrar: () => void;
  /** Si viene, el formulario edita ese equipo en vez de crear uno nuevo. */
  equipo?: EquipoIt;
}) {
  const esEdicion = equipo !== undefined;
  const [form, setForm] = useState<CrearEquipoInput>(
    equipo ? aFormulario(equipo) : FORMULARIO_VACIO,
  );
  const crear = useCrearEquipo();
  const actualizar = useActualizarEquipo(equipo?.id ?? '');
  const { data: tiposActivos } = useTiposEquipo(true);

  // Los catálogos del ámbito de informática: no se mezclan con los de planta.
  const { marcas, ubicaciones } = useCatalogoIt();
  const modelos = useModelosDeMarca(form.marcaId);
  const crearMarca = useCrearItemCatalogo('marcas-equipo', 'IT');
  const crearUbicacion = useCrearItemCatalogo('ubicaciones-equipo', 'IT');
  const crearModelo = useCrearModelo();

  // Al abrir el alta, se preselecciona el primer tipo del catálogo.
  useEffect(() => {
    if (!esEdicion && !form.tipoId && tiposActivos?.length) {
      setForm((f) => ({ ...f, tipoId: tiposActivos[0].id }));
    }
  }, [tiposActivos, esEdicion, form.tipoId]);
  const guardando = crear.isPending || actualizar.isPending;
  const errorGuardar = crear.error ?? actualizar.error;

  // Si el tipo elegido lleva especificaciones lo dice el catálogo: una cámara
  // o una impresora no tienen procesador ni RAM.
  const conEspecificaciones =
    (tiposActivos ?? []).find((t) => t.id === form.tipoId)?.llevaEspecificaciones ?? true;

  const cambiar = <K extends keyof CrearEquipoInput>(campo: K, valor: CrearEquipoInput[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /** Los campos vacíos no se mandan: el backend rechaza strings vacíos. */
  const limpiar = (input: CrearEquipoInput): CrearEquipoInput => {
    const salida = { ...input };
    for (const clave of Object.keys(salida) as (keyof CrearEquipoInput)[]) {
      const valor = salida[clave];
      if (valor === '' || valor === undefined || Number.isNaN(valor)) delete salida[clave];
    }
    return salida;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esEdicion) {
      await actualizar.mutateAsync(limpiar(form));
    } else {
      await crear.mutateAsync(limpiar(form));
    }
    alCerrar();
  };

  return (
    <Modal
      titulo={esEdicion ? `Editar ${nombreDelEquipo(equipo)}` : 'Nuevo equipo'}
      abierto
      tamano="ancho"
      onCerrar={alCerrar}
    >
      <form onSubmit={enviar} className="formulario-modal">
        <div className="grilla-campos">
          <label>
            Tipo *
            <select
              value={form.tipoId}
              onChange={(e) => cambiar('tipoId', e.target.value)}
              required
            >
              {(tiposActivos ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={form.estado ?? 'EN_DEPOSITO'}
              onChange={(e) => cambiar('estado', e.target.value as EstadoEquipoIt)}
            >
              {ESTADOS.map((es) => (
                <option key={es} value={es}>
                  {ETIQUETA_ESTADO[es]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Código interno
            <input
              value={form.codigoInterno ?? ''}
              onChange={(e) => cambiar('codigoInterno', e.target.value)}
              placeholder="IT-0042"
            />
          </label>
          <SelectorCatalogo
            id="equipo-marca"
            etiqueta="Marca"
            valor={form.marcaId ?? ''}
            opciones={marcas.data ?? []}
            creando={crearMarca.isPending}
            onCambiar={(id) => {
              // Cambiar de marca invalida el modelo: un modelo pertenece a una
              // marca, y dejarlo colgado guardaria un par que no existe.
              setForm((f) => ({ ...f, marcaId: id || undefined, modeloId: undefined }));
            }}
            onCrear={async (nombre) => (await crearMarca.mutateAsync({ nombre })).id}
          />
          <SelectorCatalogo
            id="equipo-modelo"
            etiqueta="Modelo"
            valor={form.modeloId ?? ''}
            opciones={modelos.data ?? []}
            deshabilitado={!form.marcaId}
            creando={crearModelo.isPending}
            ayuda={form.marcaId ? undefined : 'Elegí la marca primero: el modelo cuelga de ella.'}
            onCambiar={(id) => cambiar('modeloId', id || undefined)}
            onCrear={async (nombre) =>
              (await crearModelo.mutateAsync({ marcaId: form.marcaId as string, nombre })).id
            }
          />
          <label>
            Nº de serie
            <input
              value={form.numeroSerie ?? ''}
              onChange={(e) => cambiar('numeroSerie', e.target.value)}
            />
          </label>
          <SelectorCatalogo
            id="equipo-ubicacion"
            etiqueta="Ubicación"
            valor={form.ubicacionId ?? ''}
            opciones={ubicaciones.data ?? []}
            creando={crearUbicacion.isPending}
            onCambiar={(id) => cambiar('ubicacionId', id || undefined)}
            onCrear={async (nombre) => (await crearUbicacion.mutateAsync({ nombre })).id}
          />

        </div>

        {conEspecificaciones && (
          <>
            <h3 className="subtitulo-form">Especificaciones</h3>
            <div className="grilla-campos">
              <label>
                Procesador
                <input
                  value={form.procesador ?? ''}
                  onChange={(e) => cambiar('procesador', e.target.value)}
                  placeholder="Intel Core i5-1135G7"
                />
              </label>
              <label>
                Memoria RAM (GB)
                <CampoNumero
                  min={1}
                  valor={form.memoriaRamGb}
                  onCambio={(v) => cambiar('memoriaRamGb', v)}
                />
              </label>
              <label>
                Tipo de disco
                <select
                  value={form.discoTipo ?? ''}
                  onChange={(e) =>
                    cambiar('discoTipo', (e.target.value || undefined) as CrearEquipoInput['discoTipo'])
                  }
                >
                  <option value="">—</option>
                  <option value="HDD">HDD</option>
                  <option value="SSD">SSD</option>
                  <option value="NVME">NVMe</option>
                  <option value="EMMC">eMMC</option>
                </select>
              </label>
              <label>
                Capacidad del disco (GB)
                <CampoNumero
                  min={1}
                  valor={form.discoCapacidadGb}
                  onCambio={(v) => cambiar('discoCapacidadGb', v)}
                />
              </label>
              <label>
                Sistema operativo
                <input
                  value={form.sistemaOperativo ?? ''}
                  onChange={(e) => cambiar('sistemaOperativo', e.target.value)}
                  placeholder="Windows 11 Pro"
                />
              </label>
            </div>
          </>
        )}

        <h3 className="subtitulo-form">Red y acceso remoto</h3>
        <div className="grilla-campos">
          <label>
            Dirección IP
            <input
              value={form.direccionIp ?? ''}
              onChange={(e) => cambiar('direccionIp', e.target.value)}
              placeholder="192.168.1.50"
            />
          </label>
          <label>
            Dirección MAC
            <input
              value={form.direccionMac ?? ''}
              onChange={(e) => cambiar('direccionMac', e.target.value)}
              placeholder="00:1A:2B:3C:4D:5E"
            />
          </label>
          <label>
            Nombre en la red
            <input
              value={form.nombreEnRed ?? ''}
              onChange={(e) => cambiar('nombreEnRed', e.target.value)}
              placeholder="PC-ADMIN-01"
            />
          </label>
          <label>
            Acceso remoto
            <select
              value={form.accesoRemoto ?? 'NINGUNO'}
              onChange={(e) =>
                cambiar('accesoRemoto', e.target.value as CrearEquipoInput['accesoRemoto'])
              }
            >
              {(Object.keys(ETIQUETA_ACCESO) as (keyof typeof ETIQUETA_ACCESO)[]).map((a) => (
                <option key={a} value={a}>
                  {ETIQUETA_ACCESO[a]}
                </option>
              ))}
            </select>
          </label>
          {form.accesoRemoto && form.accesoRemoto !== 'NINGUNO' && (
            <label>
              ID de acceso remoto
              <input
                value={form.accesoRemotoId ?? ''}
                onChange={(e) => cambiar('accesoRemotoId', e.target.value)}
                placeholder="123 456 789"
              />
            </label>
          )}
        </div>

        <h3 className="subtitulo-form">Compra y garantía</h3>
        <div className="grilla-campos">
          <label>
            Fecha de compra
            <input
              type="date"
              value={form.fechaCompra?.slice(0, 10) ?? ''}
              onChange={(e) =>
                cambiar('fechaCompra', e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined)
              }
            />
          </label>
          <label>
            Garantía hasta
            <input
              type="date"
              value={form.garantiaHasta?.slice(0, 10) ?? ''}
              onChange={(e) =>
                cambiar(
                  'garantiaHasta',
                  e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined,
                )
              }
            />
          </label>
        </div>

        <label>
          Notas
          <textarea
            rows={2}
            value={form.notas ?? ''}
            onChange={(e) => cambiar('notas', e.target.value)}
          />
        </label>

        {errorGuardar && <MensajeError error={errorGuardar} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar equipo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────── Detalle ───────────────────────────
