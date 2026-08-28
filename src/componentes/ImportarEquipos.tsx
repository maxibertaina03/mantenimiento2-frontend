import { useState } from 'react';
import { useImportarEquipos } from '@/api/equiposIt';
import { leerInventario, type FilaInventario } from '@/lib/csvImportacion';
import { MensajeError } from './Estados';
import { Modal } from './Modal';
import type { ResultadoImportacion } from '@/tipos/equipoIt';

const MAX_VISTA_PREVIA = 8;

/**
 * Importación del inventario desde un CSV.
 *
 * El archivo se lee en el navegador y se muestra una vista previa ANTES de
 * mandar nada: importar 60 equipos a ciegas y descubrir después que el archivo
 * estaba mal es mucho peor que revisar tres filas antes de confirmar.
 */
export function ImportarEquipos({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [filas, setFilas] = useState<FilaInventario[]>([]);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  const importar = useImportarEquipos();

  const limpiar = () => {
    setFilas([]);
    setIgnoradas([]);
    setFaltantes([]);
    setNombreArchivo('');
    setErrorLectura(null);
    setResultado(null);
  };

  const cerrar = () => {
    limpiar();
    onCerrar();
  };

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    limpiar();
    setNombreArchivo(archivo.name);
    try {
      const contenido = await archivo.text();
      const { filas: leidas, columnasIgnoradas, columnasFaltantes } = leerInventario(contenido);

      if (leidas.length === 0) {
        setErrorLectura(
          'No se encontraron filas con datos. Revisá que el archivo sea el CSV del inventario y que tenga encabezados.',
        );
        return;
      }
      setFilas(leidas);
      setIgnoradas(columnasIgnoradas);
      setFaltantes(columnasFaltantes);
    } catch {
      setErrorLectura('No se pudo leer el archivo. ¿Es un CSV?');
    }
  };

  const confirmar = async () => {
    const r = await importar.mutateAsync({ filas });
    setResultado(r);
  };

  return (
    <Modal titulo="Importar inventario" abierto={abierto} tamano="ancho" onCerrar={cerrar}>
      <div className="formulario-modal">
        {!resultado && (
          <>
            <p className="texto-suave">
              Subí el archivo <strong>CSV</strong> de la exportación de Notion. Si volvés a
              importar el mismo inventario, los equipos se actualizan en vez de duplicarse.
            </p>

            <label className="campo">
              Archivo CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => elegirArchivo(e.target.files?.[0])}
              />
            </label>

            {errorLectura && <div className="alerta alerta-error">⚠️ {errorLectura}</div>}

            {filas.length > 0 && (
              <>
                <div className="alerta alerta-exito">
                  ✔ Se leyeron <strong>{filas.length} equipos</strong> de {nombreArchivo}.
                </div>

                {ignoradas.length > 0 && (
                  <p className="texto-suave texto-chico">
                    Columnas que no se importan: {ignoradas.join(', ')}.{' '}
                    {ignoradas.some((c) => /contrase/i.test(c)) && (
                      <strong>
                        Las contraseñas quedan fuera del sistema a propósito: guardalas en un
                        gestor de contraseñas.
                      </strong>
                    )}
                  </p>
                )}

                {faltantes.length > 0 && (
                  <p className="texto-suave texto-chico">
                    No se encontraron estas columnas: {faltantes.join(', ')}. Esos datos van a
                    quedar vacíos.
                  </p>
                )}

                <h3 className="subtitulo-form">Vista previa</h3>
                <div className="tabla-scroll tabla-cards-contenedor">
                  <table className="tabla tabla-cards">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        <th>Tipo</th>
                        <th>Modelo</th>
                        <th>Estado</th>
                        <th>Ubicación</th>
                        <th>Asignado a</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.slice(0, MAX_VISTA_PREVIA).map((f, i) => (
                        <tr key={i}>
                          <td data-etiqueta="Equipo">{f.nombreEquipo ?? '—'}</td>
                          <td data-etiqueta="Tipo">{f.tipo ?? '—'}</td>
                          <td data-etiqueta="Modelo">{f.modelo ?? '—'}</td>
                          <td data-etiqueta="Estado">{f.estado ?? '—'}</td>
                          <td data-etiqueta="Ubicación">{f.ubicacion ?? '—'}</td>
                          <td data-etiqueta="Asignado a">{f.asignadoA ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filas.length > MAX_VISTA_PREVIA && (
                  <p className="texto-suave texto-chico">
                    …y {filas.length - MAX_VISTA_PREVIA} equipos más.
                  </p>
                )}

                <p className="texto-suave texto-chico">
                  Las personas asignadas que todavía no estén en el sistema se van a dar de alta
                  como usuarios <strong>sin acceso</strong>: aparecen para asignarles equipos,
                  pero no pueden iniciar sesión.
                </p>
              </>
            )}

            {importar.error && <MensajeError error={importar.error} />}

            <div className="acciones">
              <button className="btn" onClick={cerrar}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                disabled={filas.length === 0 || importar.isPending}
                onClick={confirmar}
              >
                {importar.isPending ? 'Importando…' : `Importar ${filas.length} equipos`}
              </button>
            </div>
          </>
        )}

        {resultado && <Resumen resultado={resultado} onCerrar={cerrar} />}
      </div>
    </Modal>
  );
}

function Resumen({
  resultado,
  onCerrar,
}: {
  resultado: ResultadoImportacion;
  onCerrar: () => void;
}) {
  return (
    <>
      <div className="tarjetas-resumen">
        <div className="tarjeta-resumen">
          <span className="tarjeta-numero">{resultado.creados}</span>
          <span className="texto-suave">creados</span>
        </div>
        <div className="tarjeta-resumen">
          <span className="tarjeta-numero">{resultado.actualizados}</span>
          <span className="texto-suave">actualizados</span>
        </div>
        {resultado.conError > 0 && (
          <div className="tarjeta-resumen">
            <span className="tarjeta-numero">{resultado.conError}</span>
            <span className="texto-suave">con error</span>
          </div>
        )}
      </div>

      {resultado.usuariosCreados.length > 0 && (
        <>
          <h3 className="subtitulo-form">Personas dadas de alta</h3>
          <p className="texto-suave texto-chico">
            {resultado.usuariosCreados.join(' · ')}
          </p>
        </>
      )}

      {resultado.revisarMarca.length > 0 && (
        <>
          <h3 className="subtitulo-form">Revisar la marca</h3>
          <p className="texto-suave texto-chico">
            No se pudo reconocer la marca de estos equipos; el dato se guardó completo en el
            modelo: {resultado.revisarMarca.join(' · ')}
          </p>
        </>
      )}

      {resultado.errores.length > 0 && (
        <>
          <h3 className="subtitulo-form">Filas que no se importaron</h3>
          <div className="tabla-scroll tabla-cards-contenedor">
            <table className="tabla tabla-cards">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Equipo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {resultado.errores.map((e, i) => (
                  <tr key={i}>
                    <td data-etiqueta="Fila">{e.fila}</td>
                    <td data-etiqueta="Equipo">{e.equipo}</td>
                    <td data-etiqueta="Motivo">{e.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="texto-suave texto-chico">
            Corregí esas filas en la planilla y volvé a importar: los equipos que ya entraron se
            actualizan, no se duplican.
          </p>
        </>
      )}

      <div className="acciones">
        <button className="btn btn-primario" onClick={onCerrar}>
          Listo
        </button>
      </div>
    </>
  );
}
