import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  ScanText,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAdjuntarComprobante, useComprobantes, useEnlaceComprobante } from '@/api/comprobantes';
import {
  useConfirmarPreciosFactura,
  useSugerirDesdeFactura,
  type SugerenciaFactura,
} from '@/api/ordenesCompra';
import { CampoNumero } from '@/componentes/CampoNumero';
import { MensajeError } from '@/componentes/Estados';
import {
  aNeto,
  interpretarFactura,
  type FacturaLeida,
  type ItemLeido,
  type LetraFactura,
} from '@/lib/factura/interpretarFactura';
import { formatearNumero } from '@/lib/formato';
import { esAceptado, leerComprobante } from '@/lib/leerComprobante';
import { P, usePuede } from '@/lib/permisos';
import { nombreDelRenglon, type OrdenCompra } from '@/tipos/ordenCompra';
import { moneda } from './formato';

type Seguridad = SugerenciaFactura['seguridad'];

interface Fila {
  itemIndice: number | null;
  precio: number | undefined;
  incluir: boolean;
  seguridad: Seguridad;
  porEquivalencia: boolean;
}

const ETIQUETA_SEGURIDAD: Record<NonNullable<Seguridad>, { texto: string; clase: string }> = {
  ALTA: { texto: 'Seguro', clase: 'badge badge-ok' },
  MEDIA: { texto: 'Probable', clase: 'badge badge-aviso' },
  BAJA: { texto: 'Dudoso', clase: 'badge badge-error' },
};

/**
 * Cargar los precios de la orden leyendo la factura del proveedor. Es una
 * página entera: al revisar, la factura y los renglones van lado a lado.
 *
 * Tres pasos: elegir la factura (una ya adjuntada, o subir otra), leerla (en
 * el navegador: PDF o foto) y revisar. Nada se guarda hasta «Confirmar»: el
 * sistema propone qué ítem de la factura es cada renglón, y la persona dice
 * si es así. Lo que confirma se aprende para la próxima factura del proveedor.
 */
export function PreciosDesdeFactura({
  orden,
  onListo,
  onCerrar,
}: {
  orden: OrdenCompra;
  onListo: (orden: OrdenCompra) => void;
  onCerrar: () => void;
}) {
  const puede = usePuede();
  const { data: comprobantes } = useComprobantes(orden.id);
  const enlace = useEnlaceComprobante();
  const adjuntar = useAdjuntarComprobante(orden.id);
  const sugerir = useSugerirDesdeFactura(orden.id);
  const confirmar = useConfirmarPreciosFactura(orden.id);

  const [leyendo, setLeyendo] = useState<{ etapa: string; fraccion: number } | null>(null);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [factura, setFactura] = useState<FacturaLeida | null>(null);
  const [letra, setLetra] = useState<LetraFactura | null>(null);
  const [alicuota, setAlicuota] = useState(21);
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  /** La factura que se leyó, para mostrarla al lado de la revisión. */
  const [original, setOriginal] = useState<Blob | null>(null);

  const facturas = (comprobantes ?? []).filter((c) => c.tipo === 'FACTURA');

  const leer = async (archivo: Blob) => {
    setErrorLectura(null);
    setLeyendo({ etapa: 'Abriendo la factura', fraccion: 0 });
    try {
      const { leerFactura } = await import('@/lib/factura/leerTexto');
      const palabras = await leerFactura(archivo, (etapa, fraccion) =>
        setLeyendo({ etapa, fraccion }),
      );
      const leida = interpretarFactura(palabras);
      if (leida.items.length === 0) {
        setErrorLectura(
          leida.renglones === 0
            ? 'No se pudo leer texto en la factura. Si es una foto, probá con una más derecha, de cerca y con buena luz.'
            : 'Se leyó la factura, pero no se encontraron renglones con precios. Cargalos a mano con «Precios».',
        );
        return;
      }
      setLeyendo({ etapa: 'Relacionando con la orden', fraccion: 1 });
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
      setOriginal(await comoPdfSiLoEs(archivo));
      setFactura(leida);
      setLetra(leida.letra);
      setFilas(
        Object.fromEntries(
          sugerencias.map((s) => [
            s.renglonId,
            {
              itemIndice: s.itemIndice,
              precio: s.precioNeto ?? undefined,
              // Viene tildado solo si el nombre se parece (seguro o probable) Y los
              // números del renglón cierran (cantidad × precio = importe). Si el
              // OCR leyó mal un número, el nombre puede coincidir igual: el
              // precio, no. Eso lo decide la persona.
              incluir:
                (s.seguridad === 'ALTA' || s.seguridad === 'MEDIA') &&
                s.itemIndice !== null &&
                leida.items[s.itemIndice]?.cierra === true,
              seguridad: s.seguridad,
              porEquivalencia: s.porEquivalencia,
            },
          ]),
        ),
      );
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : 'No se pudo leer la factura.');
    } finally {
      setLeyendo(null);
    }
  };

  const leerAdjuntada = async (comprobanteId: string) => {
    try {
      const { url } = await enlace.mutateAsync({ ordenId: orden.id, id: comprobanteId });
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error('No se pudo bajar la factura adjuntada.');
      await leer(await respuesta.blob());
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : 'No se pudo bajar la factura.');
    }
  };

  const leerArchivoNuevo = async (archivo: File) => {
    if (!esAceptado(archivo)) {
      setErrorLectura('La factura tiene que ser un PDF o una foto (JPG, PNG o WEBP).');
      return;
    }
    // Se adjunta a la orden, como cualquier comprobante, si se puede. Si no
    // se puede (sin permiso o sin almacén), se lee igual.
    if (puede(P.ORDENES_RECIBIR)) {
      try {
        const listo = await leerComprobante(archivo);
        await adjuntar.mutateAsync({
          archivoBase64: listo.archivoBase64,
          nombreArchivo: listo.nombreArchivo,
          tipo: 'FACTURA',
        });
      } catch {
        // No se pudo guardar el archivo: no impide leer los precios.
      }
    }
    await leer(archivo);
  };

  /** Cambiar la letra o el IVA recalcula los precios que vinieron de la factura. */
  const recalcular = (nuevaLetra: LetraFactura | null, nuevaAlicuota: number) => {
    setLetra(nuevaLetra);
    setAlicuota(nuevaAlicuota);
    if (!factura) return;
    setFilas((fs) =>
      Object.fromEntries(
        Object.entries(fs).map(([id, f]) => {
          const item = f.itemIndice === null ? null : factura.items[f.itemIndice];
          return [
            id,
            item?.precioUnitario
              ? { ...f, precio: aNeto(item.precioUnitario, nuevaLetra, nuevaAlicuota) }
              : f,
          ];
        }),
      ),
    );
  };

  const elegirItem = (renglonId: string, indice: number | null) => {
    const item = indice === null ? null : factura!.items[indice];
    setFilas((fs) => ({
      ...fs,
      [renglonId]: {
        itemIndice: indice,
        precio: item?.precioUnitario ? aNeto(item.precioUnitario, letra, alicuota) : undefined,
        incluir: indice !== null,
        seguridad: null,
        porEquivalencia: false,
      },
    }));
  };

  const cambiarFila = (renglonId: string, cambio: Partial<Fila>) =>
    setFilas((fs) => ({ ...fs, [renglonId]: { ...fs[renglonId], ...cambio } }));

  const confirmadas = orden.renglones.filter((r) => {
    const f = filas[r.id];
    return f?.incluir && f.precio !== undefined && f.precio > 0;
  });

  const guardar = async () => {
    const actualizada = await confirmar.mutateAsync({
      precios: confirmadas.map((r) => ({ renglonId: r.id, precioUnitario: filas[r.id].precio! })),
      equivalencias: confirmadas.flatMap((r) => {
        const f = filas[r.id];
        const item = f.itemIndice === null ? null : factura!.items[f.itemIndice];
        return item && r.materialId
          ? [
              {
                materialId: r.materialId,
                codigoProveedor: item.codigo,
                descripcionProveedor: item.descripcion,
              },
            ]
          : [];
      }),
    });
    onListo(actualizada);
  };

  const usados = new Set(Object.values(filas).map((f) => f.itemIndice));
  const sinUsar = factura?.items.filter((i) => !usados.has(i.indice)) ?? [];
  const cuitDistinto =
    factura &&
    orden.proveedorCuit &&
    factura.cuits.length > 0 &&
    !factura.cuits.some((c) => c.replace(/\D/g, '') === orden.proveedorCuit!.replace(/\D/g, ''));

  return (
    <div className={`pagina-factura${factura && !leyendo ? ' comparando' : ''}`}>
      <div className="cabecera-pagina">
        <div>
          <h1>Precios desde la factura</h1>
          <p>
            {orden.numero} · {orden.proveedorNombre}
          </p>
        </div>
        <button type="button" className="btn" onClick={onCerrar}>
          <ArrowLeft className="icono" aria-hidden />
          Volver a la orden
        </button>
      </div>
      {!factura && !leyendo && (
        <div className="formulario-modal">
          <p className="texto-suave">
            Elegí la factura de <strong>{orden.proveedorNombre}</strong>. Se lee en esta
            computadora: un PDF al instante; una foto tarda un poco más y conviene que esté derecha,
            de cerca y con buena luz.
          </p>
          {facturas.length > 0 && (
            <ul className="lista-simple lista-facturas">
              {facturas.map((c) => (
                <li key={c.id}>
                  <span className="con-icono">
                    <FileText className="icono" aria-hidden />
                    {c.nombre}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primario"
                    disabled={enlace.isPending}
                    onClick={() => void leerAdjuntada(c.id)}
                  >
                    <ScanText className="icono" aria-hidden />
                    Leer
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="btn btn-subir-factura">
            <Upload className="icono" aria-hidden />
            {facturas.length > 0 ? 'Subir otra factura' : 'Subir la factura (PDF o foto)'}
            <input
              type="file"
              accept=".pdf,image/*"
              hidden
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = '';
                if (archivo) void leerArchivoNuevo(archivo);
              }}
            />
          </label>
          {errorLectura && <div className="alerta alerta-aviso">{errorLectura}</div>}
          {sugerir.error && <MensajeError error={sugerir.error} />}
        </div>
      )}

      {leyendo && (
        <div className="leyendo-factura" role="status">
          <p>{leyendo.etapa}…</p>
          <progress value={leyendo.fraccion} max={1} />
        </div>
      )}

      {factura && !leyendo && (
        <div className="formulario-modal factura-comparar">
          <div className="factura-revision-lado">
            <div className="factura-cabecera">
              <label>
                Tipo de factura
                <select
                  value={letra ?? ''}
                  onChange={(e) =>
                    recalcular((e.target.value || null) as LetraFactura | null, alicuota)
                  }
                >
                  <option value="">No sé</option>
                  <option value="A">A (precios sin IVA)</option>
                  <option value="B">B (precios con IVA)</option>
                  <option value="C">C (sin IVA)</option>
                </select>
              </label>
              {letra === 'B' && (
                <label>
                  IVA
                  <select
                    value={alicuota}
                    onChange={(e) => recalcular(letra, Number(e.target.value))}
                  >
                    <option value={21}>21 %</option>
                    <option value={10.5}>10,5 %</option>
                    <option value={27}>27 %</option>
                  </select>
                </label>
              )}
            </div>
            <p className="texto-suave texto-chico">
              Se guarda el precio <strong>sin IVA</strong>. Revisá cada renglón: lo marcado «Seguro» o
              «Probable» viene tildado; lo «Dudoso», no.
            </p>
            {cuitDistinto && (
              <div className="alerta alerta-aviso">
                El CUIT de la factura ({factura.cuits.join(', ')}) no es el del proveedor de la orden
                ({orden.proveedorCuit}). ¿Es la factura correcta?
              </div>
            )}

            <ul className="revision-factura">
              {orden.renglones.map((r) => {
                const f = filas[r.id];
                if (!f) return null;
                const item = f.itemIndice === null ? null : factura.items[f.itemIndice];
                const otraCantidad =
                  item?.cantidad != null && item.cantidad !== r.cantidad && item.cantidad !== 0;
                return (
                  <li key={r.id} className={`revision-renglon${f.incluir ? ' incluido' : ''}`}>
                    <div className="revision-nuestro">
                      <strong>{nombreDelRenglon(r)}</strong>
                      <span className="texto-suave texto-chico">
                        Pedido: {formatearNumero(r.cantidad)} {r.unidad}
                        {r.precioUnitario !== null && ` · hoy ${moneda(r.precioUnitario)}`}
                      </span>
                    </div>
                    <label className="revision-item">
                      <span className="texto-suave texto-chico">
                        En la factura
                        {f.seguridad && (
                          <span className={ETIQUETA_SEGURIDAD[f.seguridad].clase}>
                            {f.porEquivalencia
                              ? 'Ya conocido'
                              : ETIQUETA_SEGURIDAD[f.seguridad].texto}
                          </span>
                        )}
                      </span>
                      <select
                        aria-label={`Ítem de la factura para ${nombreDelRenglon(r)}`}
                        value={f.itemIndice ?? ''}
                        onChange={(e) =>
                          elegirItem(r.id, e.target.value === '' ? null : Number(e.target.value))
                        }
                      >
                        <option value="">— Ninguno —</option>
                        {factura.items.map((i) => (
                          <option key={i.indice} value={i.indice}>
                            {textoItem(i)}
                          </option>
                        ))}
                      </select>
                      {otraCantidad && (
                        <span className="texto-chico texto-alerta">
                          La factura dice {formatearNumero(item!.cantidad!)}: si viene por caja o por
                          paquete, ajustá el precio por unidad.
                        </span>
                      )}
                    </label>
                    <div className="revision-precio">
                      <CampoNumero
                        aria-label={`Precio sin IVA de ${nombreDelRenglon(r)}`}
                        valor={f.precio}
                        onCambio={(precio) => cambiarFila(r.id, { precio, incluir: true })}
                        min={0}
                        step="0.01"
                      />
                      <label className="casilla">
                        <input
                          type="checkbox"
                          checked={f.incluir}
                          onChange={(e) => cambiarFila(r.id, { incluir: e.target.checked })}
                        />
                        Cargar
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>

            {sinUsar.length > 0 && (
              <details className="factura-sin-usar">
                <summary className="texto-suave texto-chico">
                  {sinUsar.length === 1
                    ? '1 renglón de la factura no se relacionó'
                    : `${sinUsar.length} renglones de la factura no se relacionaron`}
                </summary>
                <ul className="lista-simple texto-chico">
                  {sinUsar.map((i) => (
                    <li key={i.indice}>{i.textoOriginal}</li>
                  ))}
                </ul>
              </details>
            )}

            {confirmar.error && <MensajeError error={confirmar.error} />}
          </div>

          {original && <FacturaOriginal archivo={original} />}

          <div className="acciones factura-acciones">
            <button type="button" className="btn" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primario"
              disabled={confirmadas.length === 0 || confirmar.isPending}
              onClick={() => void guardar()}
            >
              <Check className="icono" aria-hidden />
              {confirmar.isPending
                ? 'Guardando…'
                : `Confirmar y cargar ${confirmadas.length === 1 ? '1 precio' : `${confirmadas.length} precios`}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La factura tal cual se leyó, al lado de la revisión, para comparar con los
 * ojos: el PDF con el visor del navegador; la foto, con lupa.
 */
function FacturaOriginal({ archivo }: { archivo: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);
  useEffect(() => {
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);
  const esPdf = archivo.type === 'application/pdf';

  return (
    <section className="factura-original" aria-label="La factura leída">
      <div className="factura-original-barra">
        <strong>La factura</strong>
        {!esPdf && (
          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={ampliada}
            onClick={() => setAmpliada((a) => !a)}
          >
            {ampliada ? (
              <ZoomOut className="icono" aria-hidden />
            ) : (
              <ZoomIn className="icono" aria-hidden />
            )}
            {ampliada ? 'Ajustar' : 'Ampliar'}
          </button>
        )}
        {url && (
          <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="icono" aria-hidden />
            Abrir en otra pestaña
          </a>
        )}
      </div>
      <div className={`factura-original-vista${ampliada ? ' ampliada' : ''}`}>
        {url &&
          (esPdf ? (
            // Fit: la hoja entera a la vista, sin desplazarse.
            <iframe src={`${url}#view=Fit`} title="Factura en PDF" />
          ) : (
            <img src={url} alt="Foto de la factura" onClick={() => setAmpliada((a) => !a)} />
          ))}
      </div>
    </section>
  );
}

/**
 * La factura bajada del almacén puede venir sin tipo: si empieza con «%PDF»,
 * se le pone, para que el navegador la muestre en vez de descargarla.
 */
async function comoPdfSiLoEs(archivo: Blob): Promise<Blob> {
  if (archivo.type === 'application/pdf' || archivo.type.startsWith('image/')) return archivo;
  const inicio = await archivo.slice(0, 4).text();
  return inicio === '%PDF' ? new Blob([archivo], { type: 'application/pdf' }) : archivo;
}

/** «ROD. 6204 2RS · 4 × $ 6.050,00», para el desplegable. */
function textoItem(i: ItemLeido): string {
  const partes = [i.codigo ? `${i.codigo} ${i.descripcion}` : i.descripcion];
  if (i.cantidad !== null && i.precioUnitario !== null) {
    partes.push(`${formatearNumero(i.cantidad)} × ${moneda(i.precioUnitario)}`);
  } else if (i.precioUnitario !== null) {
    partes.push(moneda(i.precioUnitario));
  }
  return partes.join(' · ') + (i.cierra ? '' : ' (revisar)');
}
