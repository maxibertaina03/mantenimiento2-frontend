import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ElegirColumnas, type FormatoExportacion } from '../ElegirColumnas';
import { EstadoVacio } from '../Estados';
import { moneda } from '../ordenesCompra/formato';
import { armarTabla, type ColumnaReporte } from '@/lib/columnasReporte';
import { descargarCsv, generarCsv, sufijoFechaArchivo } from '@/lib/csv';
import { formatearNumero } from '@/lib/formato';
import { exportarPdf } from '@/lib/pdf';
import { textoPeriodo } from '@/lib/periodoInforme';
import type { GastoMaterial, PeriodoInforme } from '@/tipos/informe';
import { Barrita } from './piezas';

/** Cuántos se ven sin tocar «Ver todos». */
const A_LA_VISTA = 15;

const COLUMNAS: ColumnaReporte<GastoMaterial>[] = [
  { clave: 'material', titulo: 'Material', valor: (m) => m.material },
  {
    clave: 'cantidad',
    titulo: 'Cantidad',
    valor: (m) => `${formatearNumero(m.cantidad)} ${m.unidad}`,
  },
  { clave: 'promedio', titulo: 'Precio promedio', valor: (m) => moneda(m.precioPromedio) },
  { clave: 'ultimo', titulo: 'Último precio', valor: (m) => moneda(m.ultimoPrecio) },
  { clave: 'gastado', titulo: 'Gastado', valor: (m) => moneda(m.gastado) },
  { clave: 'proveedores', titulo: 'Proveedores', valor: (m) => m.proveedores.join(', ') },
  { clave: 'ordenes', titulo: 'Órdenes', valor: (m) => m.ordenes, porDefecto: false },
  {
    clave: 'sinPrecio',
    titulo: 'Renglones sin precio',
    valor: (m) => m.renglonesSinPrecio,
    porDefecto: false,
  },
];

/**
 * Lo que se gastó en cada material del período, del que más plata se llevó al
 * que menos. Se busca por nombre y se exporta, como cualquier otro listado.
 */
export function GastoPorMaterial({
  materiales,
  periodo,
}: {
  materiales: GastoMaterial[];
  periodo: PeriodoInforme;
}) {
  const [buscar, setBuscar] = useState('');
  const [todos, setTodos] = useState(false);
  const [exportando, setExportando] = useState(false);

  if (materiales.length === 0) {
    return <EstadoVacio>No hubo compras en el período.</EstadoVacio>;
  }

  const filtro = buscar.trim().toLowerCase();
  const filtrados = filtro
    ? materiales.filter((m) => m.material.toLowerCase().includes(filtro))
    : materiales;
  const visibles = todos || filtro ? filtrados : filtrados.slice(0, A_LA_VISTA);
  const maximo = Math.max(0, ...materiales.map((m) => m.gastado));
  const sinPrecio = materiales.filter((m) => m.renglonesSinPrecio > 0).length;

  const exportar = async (formato: FormatoExportacion, elegidas: string[]) => {
    const { encabezados, filas } = armarTabla(COLUMNAS, filtrados, elegidas);
    const nombre = `gasto_por_material_${sufijoFechaArchivo()}`;
    if (formato === 'csv') {
      descargarCsv(`${nombre}.csv`, generarCsv(encabezados, filas));
    } else {
      await exportarPdf({
        titulo: 'Gasto por material',
        subtitulo: `Compras ${textoPeriodo(periodo)} · ${filtrados.length} materiales`,
        encabezados,
        filas,
        nombreArchivo: `${nombre}.pdf`,
        orientacion: encabezados.length > 4 ? 'landscape' : 'portrait',
        resaltarFilas: filtrados.map((m) => m.renglonesSinPrecio > 0),
        leyenda: sinPrecio > 0 ? 'Resaltados: tienen renglones sin precio' : undefined,
      });
    }
    setExportando(false);
  };

  return (
    <>
      <div className="gasto-material-barra no-imprimir">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar material…"
          aria-label="Buscar material"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <button type="button" className="btn btn-sm" onClick={() => setExportando(true)}>
          <Download className="icono" aria-hidden />
          Exportar
        </button>
      </div>

      <div className="tabla-scroll">
        <table className="tabla tabla-informe">
          <thead>
            <tr>
              <th>Material</th>
              <th className="numero">Cantidad</th>
              <th className="numero">Precio promedio</th>
              <th className="numero">Último precio</th>
              <th>Gastado</th>
              <th>Proveedores</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m) => (
              <tr key={m.materialId ?? m.material}>
                <td>
                  {m.materialId ? (
                    <Link to={`/materiales/${m.materialId}`}>{m.material}</Link>
                  ) : (
                    m.material
                  )}
                  {m.renglonesSinPrecio > 0 && (
                    <span className="texto-suave texto-chico">
                      {' '}
                      · {m.renglonesSinPrecio} sin precio
                    </span>
                  )}
                </td>
                <td className="numero">
                  {formatearNumero(m.cantidad)} {m.unidad}
                </td>
                <td className="numero">{moneda(m.precioPromedio)}</td>
                <td className="numero">{moneda(m.ultimoPrecio)}</td>
                <td>
                  <Barrita
                    valor={m.gastado}
                    maximo={maximo}
                    tono="verde"
                    texto={moneda(m.gastado)}
                  />
                </td>
                <td className="texto-chico">{m.proveedores.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length === 0 && <EstadoVacio>Ningún material con ese nombre.</EstadoVacio>}
      {!filtro && filtrados.length > A_LA_VISTA && (
        <button
          type="button"
          className="btn btn-fantasma btn-sm no-imprimir"
          onClick={() => setTodos((v) => !v)}
        >
          {todos ? 'Ver menos' : `Ver los ${filtrados.length}`}
        </button>
      )}

      {exportando && (
        <ElegirColumnas
          titulo="Exportar el gasto por material"
          reporte="gasto-por-material"
          columnas={COLUMNAS}
          onExportar={(formato, elegidas) => void exportar(formato, elegidas)}
          onCerrar={() => setExportando(false)}
        />
      )}
    </>
  );
}
