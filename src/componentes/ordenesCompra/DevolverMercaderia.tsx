import { ScanText, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useAdjuntarComprobante } from '@/api/comprobantes';
import { useDevolverOrden, useSugerirDesdeFactura } from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { MensajeError } from '@/componentes/Estados';
import { aNeto, interpretarFactura } from '@/lib/factura/interpretarFactura';
import { formatearNumero } from '@/lib/formato';
import { esAceptado, leerComprobante } from '@/lib/leerComprobante';
import { P, usePuede } from '@/lib/permisos';
import { nombreDelRenglon, type OrdenCompra } from '@/tipos/ordenCompra';
import { moneda } from './formato';

interface Fila {
  cantidad: number | undefined;
  precio: number | undefined;
  /** Si sale del pañol. No, cuando ya se usó y no está en el estante. */
  moverStock: boolean;
}

const hoy = () => {
  const d = new Date();
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
};

/**
 * Devolverle al proveedor mercadería que ya llegó, con su nota de crédito.
 *
 * Se elige qué y cuánto vuelve (todo o una parte). Lo devuelto sale del pañol,
 * salvo lo que ya se usó. La nota de crédito se puede leer como una factura:
 * completa cantidades y precios, que se revisan antes de confirmar.
 */
export function DevolverMercaderia({
  orden,
  onListo,
  onCancelar,
}: {
  orden: OrdenCompra;
  onListo: (orden: OrdenCompra) => void;
  onCancelar: () => void;
}) {
  const puede = usePuede();
  const devolver = useDevolverOrden(orden.id);
  const adjuntar = useAdjuntarComprobante(orden.id);
  const sugerir = useSugerirDesdeFactura(orden.id);

  // Solo materiales que llegaron y todavía no volvieron.
  const devolvibles = orden.renglones.filter(
    (r) => r.materialId && r.cantidadRecibida - r.cantidadDevuelta > 0.0005,
  );
  const maximo = (id: string) => {
    const r = orden.renglones.find((x) => x.id === id)!;
    return Math.round((r.cantidadRecibida - r.cantidadDevuelta) * 1000) / 1000;
  };

  const [fecha, setFecha] = useState(hoy);
  const [notaCredito, setNotaCredito] = useState('');
  const [motivo, setMotivo] = useState('');
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(
      devolvibles.map((r) => [
        r.id,
        { cantidad: undefined, precio: r.precioUnitario ?? undefined, moverStock: true },
      ]),
    ),
  );
  const [leyendo, setLeyendo] = useState<string | null>(null);
  const [avisoLectura, setAvisoLectura] = useState<string | null>(null);

  const cambiar = (id: string, cambio: Partial<Fila>) =>
    setFilas((fs) => ({ ...fs, [id]: { ...fs[id], ...cambio } }));

  const devolverTodo = () =>
    setFilas((fs) =>
      Object.fromEntries(Object.entries(fs).map(([id, f]) => [id, { ...f, cantidad: maximo(id) }])),
    );

  /** Lee la nota de crédito y completa cantidad y precio de lo que reconoce. */
  const leerNotaDeCredito = async (archivo: File) => {
    setAvisoLectura(null);
    if (!esAceptado(archivo)) {
      setAvisoLectura('La nota de crédito tiene que ser un PDF o una foto.');
      return;
    }
    setLeyendo('Leyendo la nota de crédito…');
    try {
      // Queda adjunta a la orden, como cualquier comprobante, si se puede.
      try {
        const listo = await leerComprobante(archivo);
        await adjuntar.mutateAsync({
          archivoBase64: listo.archivoBase64,
          nombreArchivo: listo.nombreArchivo,
          tipo: 'NOTA_CREDITO',
        });
      } catch {
        // Sin almacén o sin lugar: se lee igual.
      }
      const { leerFactura } = await import('@/lib/factura/leerTexto');
      const leida = interpretarFactura(
        await leerFactura(archivo, (etapa) => setLeyendo(`${etapa}…`)),
      );
      if (leida.items.length === 0) {
        setAvisoLectura('No se encontraron renglones en la nota de crédito: completalos a mano.');
        return;
      }
      const sugerencias = await sugerir.mutateAsync({
        items: leida.items.map(({ indice, codigo, descripcion, cantidad, precioUnitario }) => ({
          indice,
          codigo,
          descripcion,
          cantidad,
          precioUnitario,
        })),
        letra: leida.letra,
        alicuota: 21,
      });
      // Lo que se reconoce con seguridad (no lo dudoso) completa cantidad y precio.
      const cambios = sugerencias.flatMap((sug) => {
        if (sug.itemIndice === null || sug.seguridad === 'BAJA') return [];
        if (!devolvibles.some((r) => r.id === sug.renglonId)) return [];
        const item = leida.items[sug.itemIndice];
        return [
          {
            renglonId: sug.renglonId,
            cantidad:
              item.cantidad !== null ? Math.min(item.cantidad, maximo(sug.renglonId)) : undefined,
            precio: item.precioUnitario ? aNeto(item.precioUnitario, leida.letra, 21) : undefined,
          },
        ];
      });
      setFilas((fs) => {
        const nuevas = { ...fs };
        for (const c of cambios) {
          nuevas[c.renglonId] = { ...nuevas[c.renglonId], cantidad: c.cantidad, precio: c.precio };
        }
        return nuevas;
      });
      const completados = cambios.length;
      setAvisoLectura(
        completados > 0
          ? `Se completaron ${completados} renglones desde la nota de crédito. Revisalos antes de confirmar.`
          : 'Se leyó la nota de crédito, pero no se pudo relacionar con los renglones: completalos a mano.',
      );
    } catch (e) {
      setAvisoLectura(e instanceof Error ? e.message : 'No se pudo leer la nota de crédito.');
    } finally {
      setLeyendo(null);
    }
  };

  const elegidos = devolvibles.filter((r) => (filas[r.id]?.cantidad ?? 0) > 0);
  const excedido = elegidos.find((r) => (filas[r.id].cantidad ?? 0) > maximo(r.id) + 0.0005);
  const monto = elegidos.reduce(
    (t, r) => t + (filas[r.id].cantidad ?? 0) * (filas[r.id].precio ?? 0),
    0,
  );

  const confirmar = async () => {
    const actualizada = await devolver.mutateAsync({
      fecha: new Date(`${fecha}T12:00:00`).toISOString(),
      notaCredito: notaCredito.trim() || undefined,
      motivo: motivo.trim() || undefined,
      renglones: elegidos.map((r) => ({
        renglonId: r.id,
        cantidad: filas[r.id].cantidad!,
        precioUnitario: filas[r.id].precio && filas[r.id].precio! > 0 ? filas[r.id].precio! : null,
        moverStock: filas[r.id].moverStock,
      })),
    });
    onListo(actualizada);
  };

  if (devolvibles.length === 0) {
    return (
      <div className="panel">
        <p className="texto-suave">
          No queda nada para devolver: todo lo que llegó ya volvió al proveedor.
        </p>
        <div className="acciones">
          <button type="button" className="btn" onClick={onCancelar}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="subtitulo-form">
        <Undo2 className="icono" aria-hidden /> Devolver al proveedor
      </h3>
      <p className="texto-suave texto-chico">
        Lo que se devuelve sale del pañol. Si algo ya se usó y no está en el estante, desmarcá «Sale
        del pañol» en ese renglón.
      </p>

      <div className="grilla-campos">
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Nº de nota de crédito
          <input
            value={notaCredito}
            onChange={(e) => setNotaCredito(e.target.value)}
            placeholder="00008-00000828"
          />
        </label>
        <label>
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="No era el modelo, vino fallado…"
          />
        </label>
      </div>

      <div className="fila-acciones">
        <label className="btn btn-sm">
          <ScanText className="icono" aria-hidden />
          {leyendo ?? 'Leer la nota de crédito (PDF o foto)'}
          <input
            type="file"
            accept=".pdf,image/*"
            hidden
            disabled={leyendo !== null || !puede(P.ORDENES_EDITAR)}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              e.target.value = '';
              if (archivo) void leerNotaDeCredito(archivo);
            }}
          />
        </label>
        <button type="button" className="btn btn-sm btn-fantasma" onClick={devolverTodo}>
          Devolver todo
        </button>
      </div>
      {avisoLectura && <div className="alerta alerta-aviso texto-chico">{avisoLectura}</div>}

      <ul className="revision-factura">
        {devolvibles.map((r) => {
          const f = filas[r.id];
          return (
            <li
              key={r.id}
              className={`revision-renglon${(f.cantidad ?? 0) > 0 ? ' incluido' : ''}`}
            >
              <div className="revision-nuestro">
                <strong>{nombreDelRenglon(r)}</strong>
                <span className="texto-suave texto-chico">
                  Llegó {formatearNumero(r.cantidadRecibida)} {r.unidad ?? ''}
                  {r.cantidadDevuelta > 0 &&
                    ` · ya devuelto ${formatearNumero(r.cantidadDevuelta)}`}
                </span>
              </div>
              <label className="revision-item">
                <span className="texto-suave texto-chico">
                  Cantidad a devolver (hasta {formatearNumero(maximo(r.id))})
                </span>
                <CampoNumero
                  aria-label={`Cantidad a devolver de ${nombreDelRenglon(r)}`}
                  valor={f.cantidad}
                  onCambio={(cantidad) => cambiar(r.id, { cantidad })}
                  min={0}
                  max={maximo(r.id)}
                  step="any"
                />
              </label>
              <div className="revision-precio">
                <span className="texto-suave texto-chico">Precio sin IVA</span>
                <CampoNumero
                  aria-label={`Precio de ${nombreDelRenglon(r)} en la nota de crédito`}
                  valor={f.precio}
                  onCambio={(precio) => cambiar(r.id, { precio })}
                  min={0}
                  step="0.01"
                />
                <label className="casilla">
                  <input
                    type="checkbox"
                    checked={f.moverStock}
                    onChange={(e) => cambiar(r.id, { moverStock: e.target.checked })}
                  />
                  Sale del pañol
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {excedido && (
        <div className="alerta alerta-aviso texto-chico">
          De «{nombreDelRenglon(excedido)}» se pueden devolver hasta{' '}
          {formatearNumero(maximo(excedido.id))}.
        </div>
      )}
      {devolver.error && <MensajeError error={devolver.error} />}

      <div className="acciones">
        <span className="texto-suave texto-chico">
          {elegidos.length > 0 && monto > 0 && `Acredita ${moneda(monto)} sin IVA`}
        </span>
        <button type="button" className="btn" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primario"
          disabled={elegidos.length === 0 || Boolean(excedido) || devolver.isPending}
          onClick={() => void confirmar()}
        >
          <Undo2 className="icono" aria-hidden />
          {devolver.isPending
            ? 'Guardando…'
            : `Devolver ${elegidos.length === 1 ? '1 renglón' : `${elegidos.length} renglones`}`}
        </button>
      </div>
    </div>
  );
}
