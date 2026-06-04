import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMateriales } from '@/api/materiales';
import { useCrearMovimiento } from '@/api/movimientos';
import { useProveedores } from '@/api/proveedores';
import { MensajeError } from '@/componentes/Estados';
import { formatearNumero } from '@/lib/formato';
import {
  MOTIVOS_POR_TIPO,
  TIPOS_MOVIMIENTO,
  type CrearMovimientoInput,
  type MotivoMovimiento,
  type TipoMovimiento,
} from '@/tipos/movimiento';

const FORM_INICIAL = (materialId: string): CrearMovimientoInput => ({
  materialId,
  tipo: 'ENTRADA',
  motivo: 'COMPRA',
  cantidad: 0,
});

export function NuevoMovimientoPage() {
  const [params] = useSearchParams();
  const materialIdInicial = params.get('materialId') ?? '';

  // limite máximo permitido por el backend es 100 (PaginacionDto @Max(100)).
  const { data: materiales, error: errorMateriales } = useMateriales(1, 100);
  const { data: proveedores } = useProveedores();
  const crear = useCrearMovimiento();

  const [form, setForm] = useState<CrearMovimientoInput>(FORM_INICIAL(materialIdInicial));
  // El input datetime-local trabaja con 'YYYY-MM-DDTHH:mm'; convertimos a ISO al enviar.
  const [fechaLocal, setFechaLocal] = useState('');
  const [exito, setExito] = useState<string | null>(null);

  const materialSel = useMemo(
    () => materiales?.datos.find((m) => m.id === form.materialId),
    [materiales, form.materialId],
  );

  const set = <K extends keyof CrearMovimientoInput>(clave: K, valor: CrearMovimientoInput[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

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
    const payload: CrearMovimientoInput = {
      ...form,
      cantidad: Number(form.cantidad),
      fecha: fechaLocal ? new Date(fechaLocal).toISOString() : undefined,
      // El proveedor solo aplica a compras.
      proveedorId: form.motivo === 'COMPRA' ? form.proveedorId || undefined : undefined,
    };
    crear.mutate(payload, {
      onSuccess: (mov) => {
        setExito(`Movimiento registrado (${mov.tipo} de ${formatearNumero(mov.cantidad)}).`);
        setForm(FORM_INICIAL(form.materialId)); // conserva el material elegido
        setFechaLocal('');
      },
    });
  };

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Registrar movimiento</h1>
      </div>

      <div className="panel" style={{ maxWidth: 640 }}>
        {exito && <div className="alerta alerta-exito">✅ {exito}</div>}
        {errorMateriales && <MensajeError error={errorMateriales} />}
        {crear.error && <MensajeError error={crear.error} />}

        <form onSubmit={enviar}>
          <div className="campo">
            <label>Material</label>
            <select
              required
              value={form.materialId}
              onChange={(e) => set('materialId', e.target.value)}
            >
              <option value="" disabled>
                Elegí un material…
              </option>
              {materiales?.datos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} — stock {formatearNumero(m.stockActual)} {m.unidad}
                </option>
              ))}
            </select>
            {materialSel && (
              <p className="texto-suave" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                Stock actual: {formatearNumero(materialSel.stockActual)} {materialSel.unidad}
              </p>
            )}
          </div>

          <div className="grilla-2">
            <div className="campo">
              <label>Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => cambiarTipo(e.target.value as TipoMovimiento)}
              >
                {TIPOS_MOVIMIENTO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Motivo</label>
              <select
                value={form.motivo}
                onChange={(e) => set('motivo', e.target.value as MotivoMovimiento)}
              >
                {motivosDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="campo">
            <label>
              Cantidad
              {form.tipo === 'AJUSTE' && ' (fija el stock a este valor absoluto)'}
            </label>
            <input
              type="number"
              min={0}
              step="0.001"
              required
              value={form.cantidad}
              onChange={(e) => set('cantidad', Number(e.target.value))}
            />
            {form.tipo === 'SALIDA' && materialSel && form.cantidad > materialSel.stockActual && (
              <p className="texto-suave" style={{ fontSize: '0.8rem', color: 'var(--color-peligro)' }}>
                La salida supera el stock disponible ({formatearNumero(materialSel.stockActual)}).
                El backend la rechazará.
              </p>
            )}
          </div>

          {form.motivo === 'COMPRA' && (
            <div className="campo">
              <label>Proveedor (opcional)</label>
              <select
                value={form.proveedorId ?? ''}
                onChange={(e) => set('proveedorId', e.target.value || undefined)}
              >
                <option value="">— Sin proveedor —</option>
                {proveedores?.datos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
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
