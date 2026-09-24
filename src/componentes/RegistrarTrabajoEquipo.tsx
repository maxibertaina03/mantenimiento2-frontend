import { useState } from 'react';
import { useCrearOrdenTrabajo } from '@/api/ordenesTrabajo';
import { useProveedores } from '@/api/proveedores';
import { CampoNumero } from './CampoNumero';
import { ComboMaterial } from './ComboMaterial';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import { formatearNumero } from '@/lib/formato';
import {
  EJECUTORES,
  ETIQUETA_EJECUTOR,
  ETIQUETA_TIPO_TRABAJO,
  TIPOS_TRABAJO,
} from '@/tipos/ordenTrabajo';
import type { Ejecutor, TipoTrabajo } from '@/tipos/ordenTrabajo';
import type { Material } from '@/tipos/material';

interface Props {
  /** La máquina de planta... */
  equipoId?: string;
  /** ...o el equipo de informática. Uno de los dos. */
  equipoItId?: string;
  equipoNombre: string;
  /** Los planes de la máquina, para decir a cuál responde el trabajo. */
  planes?: { id: string; nombre: string }[];
  onCerrar: () => void;
}

/** Un material que se usó, mientras se arma el formulario. */
interface MaterialElegido {
  materialId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
}

/**
 * Registrar un trabajo que ya se le hizo a una máquina.
 *
 * Es el camino desde la ficha: alguien arregló algo y quiere dejarlo anotado.
 * Sale una orden de trabajo ya cerrada, con lo que se usó descontado del pañol.
 * Antes esto era una «intervención», un registro aparte que contestaba la misma
 * pregunta; ahora hay un solo historial por máquina.
 *
 * Los campos de costo y servicio externo van plegados a propósito: el que solo
 * quiere anotar que cambió un retén no tiene que encontrarse con diez campos.
 */
export function RegistrarTrabajoEquipo({
  equipoId,
  equipoItId,
  equipoNombre,
  planes = [],
  onCerrar,
}: Props) {
  // Los ejemplos de los campos cambian según qué se esté arreglando. Un
  // "sello mecánico" en el formulario de una PC no ayuda a nadie a entender
  // qué se espera que escriba.
  const esInformatica = Boolean(equipoItId);
  const crear = useCrearOrdenTrabajo();
  const proveedores = useProveedores(1, 200, '');

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoTrabajo>('CORRECTIVO');
  const [resolucion, setResolucion] = useState('');
  const [fecha, setFecha] = useState('');
  const [planId, setPlanId] = useState('');

  const [materiales, setMateriales] = useState<MaterialElegido[]>([]);
  const [material, setMaterial] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState<number | undefined>(undefined);

  const [masDatos, setMasDatos] = useState(false);
  const [ejecutor, setEjecutor] = useState<Ejecutor>('INTERNO');
  const [proveedorId, setProveedorId] = useState('');
  const [costo, setCosto] = useState<number | undefined>(undefined);
  const [horas, setHoras] = useState<number | undefined>(undefined);

  const agregarMaterial = () => {
    if (!material || cantidad === undefined || cantidad <= 0) return;
    setMateriales((ms) => [
      ...ms,
      { materialId: material.id, nombre: material.nombre, unidad: material.unidad, cantidad },
    ]);
    setMaterial(null);
    setCantidad(undefined);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      titulo,
      tipo,
      equipoId,
      equipoItId,
      // La resolución es lo que hace que la orden nazca cerrada.
      resolucion,
      fecha: fecha || undefined,
      planId: planId || undefined,
      ejecutor,
      proveedorId: ejecutor === 'EXTERNO' ? proveedorId : undefined,
      costoManoObra: costo,
      horasParada: horas,
      materiales: materiales.map((m) => ({ materialId: m.materialId, cantidad: m.cantidad })),
    });
    onCerrar();
  };

  const listo = titulo.trim() !== '' && resolucion.trim() !== '';

  return (
    <Modal titulo={`Registrar trabajo en ${equipoNombre}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          ¿Qué pasó? *
          <input
            type="text"
            value={titulo}
            maxLength={200}
            required
            placeholder={esInformatica ? 'La PC no arrancaba' : 'Perdida por el sello mecanico'}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <label className="campo">
          ¿Qué se hizo? *
          <textarea
            rows={3}
            value={resolucion}
            maxLength={2000}
            required
            placeholder={
              esInformatica
                ? 'Se limpio el gabinete y se actualizo Windows'
                : 'Se cambio el sello y la junta de la tapa'
            }
            onChange={(e) => setResolucion(e.target.value)}
          />
          <span className="texto-suave texto-chico">
            Es lo que va a leer el próximo que agarre {esInformatica ? 'el equipo' : 'la máquina'}.
          </span>
        </label>

        <div className="grilla-filtros">
          <label className="campo">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTrabajo)}>
              {TIPOS_TRABAJO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_TRABAJO[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Cuándo se hizo
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <span className="texto-suave texto-chico">Vacío es hoy.</span>
          </label>

          {planes.length > 0 && (
            <label className="campo">
              ¿Responde a un plan?
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">No</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <span className="texto-suave texto-chico">Registrarlo corre la próxima fecha.</span>
            </label>
          )}
        </div>

        <h3 className="subtitulo-form">Materiales que se usaron</h3>
        <div className="panel alta-renglon">
          <label className="alta-renglon-material">
            Material
            <ComboMaterial
              key={`material-${materiales.length}`}
              materialId=""
              onCambio={setMaterial}
              enfocarAlMontar={materiales.length > 0}
            />
          </label>
          <label>
            Cantidad
            <CampoNumero
              step="0.001"
              min="0.001"
              placeholder="0"
              valor={cantidad}
              onCambio={setCantidad}
            />
          </label>
          <button
            type="button"
            className="btn btn-primario alta-renglon-boton"
            disabled={!material || cantidad === undefined || cantidad <= 0}
            onClick={agregarMaterial}
          >
            + Usar
          </button>
        </div>

        {materiales.length === 0 ? (
          <p className="texto-suave texto-chico">
            Si no usaste nada del pañol, dejalo vacío. Lo que cargues acá sale del stock de verdad.
          </p>
        ) : (
          <ul className="lista-simple">
            {materiales.map((m, i) => (
              <li key={`${m.materialId}-${i}`}>
                {m.nombre} <strong>{formatearNumero(m.cantidad)}</strong> {m.unidad}
                <button
                  type="button"
                  className="btn btn-sm btn-peligro"
                  onClick={() => setMateriales((ms) => ms.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Plegado: el que solo anota que cambió un retén no necesita ver esto.
            El que registra que vino un service externo, sí. */}
        <button type="button" className="btn btn-sm" onClick={() => setMasDatos((v) => !v)}>
          {masDatos ? '− Menos datos' : '+ Más datos: quién lo hizo, costo, horas de parada'}
        </button>

        {masDatos && (
          <div className="grilla-filtros">
            <label className="campo">
              Quién lo hizo
              <select value={ejecutor} onChange={(e) => setEjecutor(e.target.value as Ejecutor)}>
                {EJECUTORES.map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_EJECUTOR[e]}
                  </option>
                ))}
              </select>
            </label>

            {ejecutor === 'EXTERNO' && (
              <label className="campo">
                Qué proveedor *
                <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                  <option value="">Elegí el proveedor</option>
                  {(proveedores.data?.datos ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="campo">
              Costo de mano de obra
              <CampoNumero
                step="0.01"
                min="0"
                placeholder="opcional"
                valor={costo}
                onCambio={setCosto}
              />
            </label>

            <label className="campo">
              Horas de parada
              <CampoNumero
                step="0.5"
                min="0"
                placeholder="opcional"
                valor={horas}
                onCambio={setHoras}
              />
              <span className="texto-suave texto-chico">
                Lo que más cuesta de una rotura no son los repuestos.
              </span>
            </label>
          </div>
        )}

        {crear.error && <MensajeError error={crear.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={
              crear.isPending || !listo || (ejecutor === 'EXTERNO' && proveedorId === '')
            }
          >
            {crear.isPending ? 'Registrando…' : 'Registrar trabajo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
