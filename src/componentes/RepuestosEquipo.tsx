import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAgregarRepuesto,
  useCambiarRepuesto,
  useQuitarRepuesto,
  useRepuestos,
} from '@/api/equipos';
import { formatearNumero } from '@/lib/formato';
import { P, usePuede } from '@/lib/permisos';
import { stockDeRepuesto } from '@/lib/stockDeRepuesto';
import type { Equipo, RepuestoEquipo } from '@/tipos/equipo';
import type { Material } from '@/tipos/material';
import { CampoNumero } from './CampoNumero';
import { ComboMaterial } from './ComboMaterial';
import { Cargando, MensajeError } from './Estados';

/**
 * Los repuestos de la máquina: qué materiales del pañol lleva.
 *
 * Es para el día que se rompe: abrir la ficha y ver qué ir a buscar, si hay y
 * dónde está, sin revolver el historial. No mueve stock; lo que se usa en una
 * reparación sigue saliendo por la orden de trabajo.
 */
export function RepuestosEquipo({ equipo }: { equipo: Equipo }) {
  const puede = usePuede();
  const puedeEditar = puede(P.EQUIPOS_EDITAR) && equipo.estado !== 'DADO_DE_BAJA';
  const repuestos = useRepuestos(equipo.id);
  const agregar = useAgregarRepuesto(equipo.id);
  const quitar = useQuitarRepuesto(equipo.id);

  const [agregando, setAgregando] = useState(false);
  const [material, setMaterial] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState<number | undefined>(undefined);
  const [notas, setNotas] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const lista = repuestos.data ?? [];
  const sinStock = lista.filter((r) => stockDeRepuesto(r).clase === 'sin').length;
  const porReponer = lista.filter((r) => stockDeRepuesto(r).clase === 'bajo').length;
  const yaEsta = material !== null && lista.some((r) => r.materialId === material.id);

  const cerrarAlta = () => {
    setAgregando(false);
    setMaterial(null);
    setCantidad(undefined);
    setNotas('');
    agregar.reset();
  };

  const confirmarAlta = async () => {
    if (!material) return;
    await agregar.mutateAsync({
      materialId: material.id,
      cantidad: cantidad ?? null,
      notas: notas.trim() || null,
    });
    cerrarAlta();
  };

  return (
    <>
      <div className="cabecera-historial">
        <h3 className="subtitulo-form">
          Repuestos{lista.length > 0 ? ` (${lista.length})` : ''}
        </h3>
        {puedeEditar && !agregando && (
          <button
            type="button"
            className="btn btn-chico btn-primario"
            onClick={() => setAgregando(true)}
          >
            + Agregar repuesto
          </button>
        )}
      </div>

      {(sinStock > 0 || porReponer > 0) && (
        <p className="aviso-repuestos">
          ⚠{' '}
          {[
            sinStock > 0 ? `${sinStock} sin stock` : null,
            porReponer > 0 ? `${porReponer} con poco stock` : null,
          ]
            .filter(Boolean)
            .join(' · ')}{' '}
          en el pañol
        </p>
      )}

      {agregando && (
        <div className="panel formulario-modal">
          <label className="campo">
            ¿Qué material del pañol lleva «{equipo.nombre}»?
            <ComboMaterial materialId="" onCambio={setMaterial} enfocarAlMontar />
          </label>
          {yaEsta && (
            <p className="aviso-escaneo es-error">
              Ya está en la lista. Si lleva más de uno, cambiá la cantidad con ✎.
            </p>
          )}
          <div className="grilla-2">
            <label className="campo">
              ¿Cuántos lleva? (opcional)
              <CampoNumero
                step="0.001"
                min="0.001"
                placeholder="Ej: 2"
                valor={cantidad}
                onCambio={setCantidad}
              />
            </label>
            <label className="campo">
              Nota (opcional)
              <input
                type="text"
                maxLength={200}
                value={notas}
                placeholder="Ej: lado motor, el de la tapa"
                onChange={(e) => setNotas(e.target.value)}
              />
            </label>
          </div>
          {agregar.error && <MensajeError error={agregar.error} />}
          <div className="acciones">
            <button type="button" className="btn" onClick={cerrarAlta}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primario"
              disabled={!material || yaEsta || agregar.isPending}
              onClick={confirmarAlta}
            >
              {agregar.isPending
                ? 'Agregando…'
                : material
                  ? `Agregar «${material.nombre}»`
                  : 'Elegí el material'}
            </button>
          </div>
        </div>
      )}

      {repuestos.isLoading && <Cargando />}
      {repuestos.error && <MensajeError error={repuestos.error} />}
      {quitar.error && <MensajeError error={quitar.error} />}

      {repuestos.data && lista.length === 0 && !agregando && (
        <p className="texto-suave texto-chico">
          Todavía no tiene repuestos cargados. Sumá los materiales del pañol que lleva esta máquina:
          el día que se rompa, vas a saber qué buscar y si hay.
        </p>
      )}

      {lista.length > 0 && (
        <ul className="repuestos">
          {lista.map((r) =>
            editandoId === r.id ? (
              <EditarRepuesto
                key={r.id}
                equipoId={equipo.id}
                repuesto={r}
                onListo={() => setEditandoId(null)}
              />
            ) : (
              <FilaRepuesto
                key={r.id}
                repuesto={r}
                puedeEditar={puedeEditar}
                ocupado={quitar.isPending}
                onEditar={() => setEditandoId(r.id)}
                onQuitar={() => {
                  if (confirm(`¿Sacar «${r.materialNombre}» de los repuestos de ${equipo.nombre}?`)) {
                    quitar.mutate(r.id);
                  }
                }}
              />
            ),
          )}
        </ul>
      )}
    </>
  );
}

function FilaRepuesto({
  repuesto: r,
  puedeEditar,
  ocupado,
  onEditar,
  onQuitar,
}: {
  repuesto: RepuestoEquipo;
  puedeEditar: boolean;
  ocupado: boolean;
  onEditar: () => void;
  onQuitar: () => void;
}) {
  const stock = stockDeRepuesto(r);
  const detalle = [
    r.cantidad !== null ? `Lleva ${formatearNumero(r.cantidad)}${r.unidad ? ` ${r.unidad}` : ''}` : null,
    r.notas,
  ].filter(Boolean);

  return (
    <li className="repuesto">
      <div className="repuesto-info">
        <Link to={`/materiales/${r.materialId}`} className="repuesto-nombre">
          {r.materialNombre}
        </Link>
        {detalle.length > 0 && <div className="texto-chico">{detalle.join(' · ')}</div>}
        {r.ubicacion && <div className="texto-suave texto-chico">📍 {r.ubicacion}</div>}
      </div>
      <span className={`chip-stock chip-stock-${stock.clase}`}>{stock.texto}</span>
      {puedeEditar && (
        <div className="acciones-catalogo">
          <button
            type="button"
            className="btn btn-sm"
            title="Cambiar cantidad o nota"
            aria-label={`Cambiar ${r.materialNombre}`}
            onClick={onEditar}
          >
            ✎
          </button>
          <button
            type="button"
            className="btn btn-sm btn-peligro"
            title="Sacar de la lista"
            aria-label={`Sacar ${r.materialNombre}`}
            disabled={ocupado}
            onClick={onQuitar}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

function EditarRepuesto({
  equipoId,
  repuesto,
  onListo,
}: {
  equipoId: string;
  repuesto: RepuestoEquipo;
  onListo: () => void;
}) {
  const cambiar = useCambiarRepuesto(equipoId);
  const [cantidad, setCantidad] = useState<number | undefined>(repuesto.cantidad ?? undefined);
  const [notas, setNotas] = useState(repuesto.notas ?? '');

  const guardar = async () => {
    await cambiar.mutateAsync({
      repuestoId: repuesto.id,
      cantidad: cantidad ?? null,
      notas: notas.trim() || null,
    });
    onListo();
  };

  return (
    <li className="repuesto repuesto-editando">
      <div className="repuesto-info">
        <strong>{repuesto.materialNombre}</strong>
        <div className="grilla-2">
          <label className="campo">
            ¿Cuántos lleva?
            <CampoNumero
              step="0.001"
              min="0.001"
              placeholder="Vacío: no se dice"
              valor={cantidad}
              onCambio={setCantidad}
            />
          </label>
          <label className="campo">
            Nota
            <input
              type="text"
              maxLength={200}
              value={notas}
              placeholder="Ej: lado motor"
              onChange={(e) => setNotas(e.target.value)}
            />
          </label>
        </div>
        {cambiar.error && <MensajeError error={cambiar.error} />}
        <div className="acciones">
          <button type="button" className="btn btn-sm" onClick={onListo}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primario"
            disabled={cambiar.isPending}
            onClick={guardar}
          >
            {cambiar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </li>
  );
}
