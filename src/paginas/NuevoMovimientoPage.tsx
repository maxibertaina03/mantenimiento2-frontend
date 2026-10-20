import { ArrowDownToLine, ArrowUpFromLine, Scale, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCrearMovimiento } from '@/api/movimientos';
import { CampoNumero } from '@/componentes/CampoNumero';
import { ComboMaterial } from '@/componentes/ComboMaterial';
import { ComboProveedor } from '@/componentes/ComboProveedor';
import { MensajeError } from '@/componentes/Estados';
import { formatearNumero } from '@/lib/formato';
import type { Material } from '@/tipos/material';
import {
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  MOTIVOS_POR_TIPO,
  TIPOS_MOVIMIENTO,
  type CrearMovimientoInput,
  type MotivoMovimiento,
  type TipoMovimiento,
} from '@/tipos/movimiento';

/**
 * Borrador del formulario. Se distingue de `CrearMovimientoInput` (el payload
 * que espera la API) porque mientras se escribe la cantidad puede estar vacía:
 * el input es obligatorio, así que el navegador no deja enviar sin completarla.
 */
type BorradorMovimiento = Omit<CrearMovimientoInput, 'cantidad'> & {
  cantidad?: number;
};

/** Cada tipo con su ícono y su color: se elige de un toque, sin desplegar nada. */
const ICONO_TIPO: Record<TipoMovimiento, LucideIcon> = {
  ENTRADA: ArrowDownToLine,
  SALIDA: ArrowUpFromLine,
  AJUSTE: Scale,
};

const FORM_INICIAL = (materialId: string): BorradorMovimiento => ({
  materialId,
  tipo: 'ENTRADA',
  motivo: 'COMPRA',
  cantidad: undefined,
});

export function NuevoMovimientoPage() {
  const [params] = useSearchParams();
  const materialIdInicial = params.get('materialId') ?? '';

  const crear = useCrearMovimiento();

  const [form, setForm] = useState<BorradorMovimiento>(FORM_INICIAL(materialIdInicial));
  // Material elegido en el combo (para mostrar stock y validar).
  const [materialSel, setMaterialSel] = useState<Material | null>(null);
  // El input datetime-local trabaja con 'YYYY-MM-DDTHH:mm'; convertimos a ISO al enviar.
  const [fechaLocal, setFechaLocal] = useState('');
  const [exito, setExito] = useState<string | null>(null);

  const set = <K extends keyof BorradorMovimiento>(clave: K, valor: BorradorMovimiento[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  const elegirMaterial = (m: Material | null) => {
    setMaterialSel(m);
    set('materialId', m?.id ?? '');
  };

  // Motivos válidos para el tipo elegido.
  const motivosDisponibles = MOTIVOS_POR_TIPO[form.tipo];

  // Al cambiar el tipo, si el motivo actual ya no aplica, lo ajustamos al primero válido.
  const cambiarTipo = (nuevoTipo: TipoMovimiento) => {
    const validos = MOTIVOS_POR_TIPO[nuevoTipo];
    setForm((f) => ({
      ...f,
      tipo: nuevoTipo,
      motivo: validos.includes(f.motivo) ? f.motivo : validos[0],
    }));
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setExito(null);
    if (!form.materialId) return; // sin material no se puede registrar
    const payload: CrearMovimientoInput = {
      ...form,
      cantidad: form.cantidad ?? 0,
      fecha: fechaLocal ? new Date(fechaLocal).toISOString() : undefined,
      // El proveedor solo aplica a compras.
      proveedorId: form.motivo === 'COMPRA' ? form.proveedorId || undefined : undefined,
    };
    crear.mutate(payload, {
      onSuccess: (mov) => {
        setExito(
          `Movimiento registrado: ${ETIQUETA_TIPO[mov.tipo].toLowerCase()} de ${formatearNumero(mov.cantidad)}.`,
        );
        setForm(FORM_INICIAL(form.materialId)); // conserva el material elegido
        setFechaLocal('');
      },
    });
  };

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Registrar movimiento</h1>
          <p>Lo que entra al pañol, lo que sale y las correcciones de stock.</p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 640 }}>
        {exito && <div className="alerta alerta-exito">{exito}</div>}
        {crear.error && <MensajeError error={crear.error} />}

        <form onSubmit={enviar}>
          <div className="campo">
            <label>Material</label>
            <ComboMaterial materialId={materialIdInicial} onCambio={elegirMaterial} />
            {materialSel && (
              <p className="texto-suave" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                Stock actual: {formatearNumero(materialSel.stockActual)} {materialSel.unidad}
              </p>
            )}
          </div>

          {/* El tipo, en tres botones grandes: en el celular se elige con el
              pulgar, sin abrir un desplegable. */}
          <fieldset className="campo selector-tipo">
            <legend>Tipo</legend>
            <div className="opciones-tipo">
              {TIPOS_MOVIMIENTO.map((t) => {
                const Icono = ICONO_TIPO[t];
                return (
                  <label key={t} className={`opcion-tipo tipo-${t.toLowerCase()}`}>
                    <input
                      type="radio"
                      name="tipo"
                      value={t}
                      checked={form.tipo === t}
                      onChange={() => cambiarTipo(t)}
                    />
                    <Icono className="icono" aria-hidden />
                    {ETIQUETA_TIPO[t]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="campo">
            <label htmlFor="motivo-movimiento">Motivo</label>
            <select
              id="motivo-movimiento"
              value={form.motivo}
              onChange={(e) => set('motivo', e.target.value as MotivoMovimiento)}
            >
              {motivosDisponibles.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MOTIVO[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label>
              Cantidad
              {form.tipo === 'AJUSTE' && ' (fija el stock a este valor absoluto)'}
            </label>
            <CampoNumero
              min={0}
              step="0.001"
              required
              valor={form.cantidad}
              onCambio={(v) => set('cantidad', v)}
            />
            {form.tipo === 'SALIDA' && materialSel && (form.cantidad ?? 0) > materialSel.stockActual && (
              <p className="texto-suave" style={{ fontSize: '0.8rem', color: 'var(--color-peligro)' }}>
                La salida supera el stock disponible ({formatearNumero(materialSel.stockActual)}).
                El backend la rechazará.
              </p>
            )}
          </div>

          {form.motivo === 'COMPRA' && (
            <div className="campo">
              <label>Proveedor (opcional)</label>
              <ComboProveedor onCambio={(p) => set('proveedorId', p?.id ?? undefined)} />
            </div>
          )}

          <div className="grilla-2">
            <div className="campo">
              <label>Fecha (opcional)</label>
              <input
                type="datetime-local"
                value={fechaLocal}
                onChange={(e) => setFechaLocal(e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Referencia de trabajo (opcional)</label>
              <input
                value={form.referenciaTrabajo ?? ''}
                onChange={(e) => set('referenciaTrabajo', e.target.value || undefined)}
                placeholder="OT-1001"
              />
            </div>
          </div>

          <div className="campo">
            <label>Notas (opcional)</label>
            <textarea
              rows={2}
              value={form.notas ?? ''}
              onChange={(e) => set('notas', e.target.value || undefined)}
            />
          </div>

          <div className="acciones">
            <button type="submit" className="btn btn-primario" disabled={crear.isPending}>
              {crear.isPending ? 'Registrando…' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
