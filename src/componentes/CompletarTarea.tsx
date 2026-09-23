import { useState } from 'react';
import { useCompletarTarea } from '@/api/calendario';
import { CampoNumero } from './CampoNumero';
import { ComboMaterial } from './ComboMaterial';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import { formatearNumero } from '@/lib/formato';
import type { Tarea } from '@/tipos/tarea';
import type { Material } from '@/tipos/material';

interface MaterialElegido {
  materialId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
}

/**
 * Dar una tarea por hecha.
 *
 * No la marca y listo: genera la orden de trabajo con lo que se usó, y si la
 * tarea salía de un plan de mantenimiento, adelanta su próxima fecha. Por eso
 * pide contar qué se hizo: ese texto es el que va a leer el próximo que agarre
 * la máquina.
 */
export function CompletarTarea({ tarea, onCerrar }: { tarea: Tarea; onCerrar: () => void }) {
  const completar = useCompletarTarea();

  const [resolucion, setResolucion] = useState('');
  const [materiales, setMateriales] = useState<MaterialElegido[]>([]);
  const [material, setMaterial] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState<number | undefined>(undefined);
  const [masDatos, setMasDatos] = useState(false);
  const [costo, setCosto] = useState<number | undefined>(undefined);
  const [horas, setHoras] = useState<number | undefined>(undefined);

  const agregar = () => {
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
    await completar.mutateAsync({
      id: tarea.id,
      resolucion,
      materiales: materiales.map((m) => ({ materialId: m.materialId, cantidad: m.cantidad })),
      costoManoObra: costo,
      horasParada: horas,
    });
    onCerrar();
  };

  return (
    <Modal titulo={`Dar por hecha: ${tarea.titulo}`} abierto tamano="ancho" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario-modal">
        <label className="campo">
          ¿Qué se hizo? *
          <textarea
            rows={3}
            value={resolucion}
            maxLength={2000}
            required
            placeholder="Se reviso la presion, estaba en 6 bar, sin novedad"
            onChange={(e) => setResolucion(e.target.value)}
          />
          <span className="texto-suave texto-chico">
            Queda como orden de trabajo{tarea.equipoNombre ? ` en ${tarea.equipoNombre}` : ''}.
          </span>
        </label>

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
            onClick={agregar}
          >
            + Usar
          </button>
        </div>

        {materiales.length === 0 ? (
          <p className="texto-suave texto-chico">
            Si no usaste nada del pañol, dejalo vacío. Lo que cargues sale del stock de verdad.
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

        <button type="button" className="btn btn-sm" onClick={() => setMasDatos((v) => !v)}>
          {masDatos ? '− Menos datos' : '+ Más datos: costo y horas de parada'}
        </button>

        {masDatos && (
          <div className="grilla-filtros">
            <label className="campo">
              Costo de mano de obra
              <CampoNumero step="0.01" min="0" placeholder="opcional" valor={costo} onCambio={setCosto} />
            </label>
            <label className="campo">
              Horas de parada
              <CampoNumero step="0.5" min="0" placeholder="opcional" valor={horas} onCambio={setHoras} />
            </label>
          </div>
        )}

        {completar.error && <MensajeError error={completar.error} />}

        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={completar.isPending || resolucion.trim() === ''}
          >
            {completar.isPending ? 'Registrando…' : 'Dar por hecha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
