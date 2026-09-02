import { useState } from 'react';
import { useDetectarImportacion, useImportarEquiposPlanta } from '@/api/equipos';
import { Cargando, MensajeError } from './Estados';
import { Modal } from './Modal';
import type { Advertencia, ResultadoImportacionEquipos } from '@/tipos/equipo';

const ETIQUETA_ADVERTENCIA: Record<Advertencia, string> = {
  posible_equipo_it: 'Puede ser de sistemas',
  posible_duplicado: 'Puede estar repetido',
  nombre_automatico: 'Nombre de cámara',
};

const EXPLICACION_ADVERTENCIA: Record<Advertencia, string> = {
  posible_equipo_it:
    'El nombre sugiere un equipo de sistemas (router, PC, impresora). Si ya está cargado en Equipos IT, importarlo lo dejaría duplicado en dos módulos.',
  posible_duplicado:
    'Existe el mismo nombre sin número y también con número. Suelen ser varias fotos del mismo equipo, no equipos distintos.',
  nombre_automatico:
    'El nombre lo puso la cámara o WhatsApp, no una persona. Conviene renombrar el archivo antes, o cargar el equipo a mano después.',
};

const ETIQUETA_DESCARTE: Record<string, string> = {
  sin_carpeta: 'Sueltos, sin sector',
  carpeta_excluida: 'En carpetas excluidas (Taller, manuales)',
  no_es_imagen: 'No son imágenes',
  sin_nombre: 'Sin nombre',
};

/**
 * Importación de equipos de planta desde la carpeta de fotos.
 *
 * El navegador manda solo los NOMBRES de los archivos, no los archivos: la
 * regla de qué es un equipo vive en el dominio del servidor, y así existe una
 * sola copia. Si la pantalla la repitiera, en algún momento las dos versiones
 * diferirían y mostraría algo distinto de lo que después se importa.
 *
 * Las fotos todavía no se suben; eso es la fase siguiente.
 */
export function ImportarEquiposPlanta({ onCerrar }: { onCerrar: () => void }) {
  const detectar = useDetectarImportacion();
  const importar = useImportarEquiposPlanta();
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [hecho, setHecho] = useState<ResultadoImportacionEquipos | null>(null);

  const deteccion = detectar.data;

  const elegirCarpeta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;

    // webkitRelativePath trae la ruta con la carpeta adelante, que es
    // justamente lo que el servidor necesita para saber el sector.
    const rutas = archivos.map((a) => a.webkitRelativePath || a.name);
    const resultado = await detectar.mutateAsync({ rutas });

    // Las filas con advertencia arrancan destildadas: es más seguro dejar algo
    // afuera y cargarlo a mano que importar veintisiete duplicados sin querer.
    setDescartadas(
      new Set(resultado.equipos.filter((eq) => eq.advertencias.length > 0).map((eq) => eq.ruta)),
    );
  };

  const alternar = (ruta: string) =>
    setDescartadas((s) => {
      const nueva = new Set(s);
      if (nueva.has(ruta)) nueva.delete(ruta);
      else nueva.add(ruta);
      return nueva;
    });

  const seleccionados = (deteccion?.equipos ?? []).filter((eq) => !descartadas.has(eq.ruta));
  const hayAdvertencias = (deteccion?.equipos ?? []).some((eq) => eq.advertencias.length > 0);

  const confirmar = async () => {
    const r = await importar.mutateAsync({
      filas: seleccionados.map((eq) => ({ nombre: eq.nombre, ubicacion: eq.ubicacion })),
    });
    setHecho(r);
  };

  if (hecho) {
    return (
      <Modal titulo="Importación terminada" abierto tamano="ancho" onCerrar={onCerrar}>
        <div className="formulario-modal">
          <div className="alerta alerta-exito">
            Se crearon <strong>{hecho.creados} equipos</strong>.
            {hecho.yaExistian > 0 && (
              <> {hecho.yaExistian} ya estaban cargados y no se tocaron.</>
            )}
          </div>

          {hecho.ubicacionesCreadas.length > 0 && (
            <p className="texto-suave texto-chico">
              Sectores nuevos: {hecho.ubicacionesCreadas.join(', ')}.
            </p>
          )}

          {hecho.fallidos.length > 0 && (
            <div className="alerta alerta-aviso">
              <strong>{hecho.fallidos.length} no se pudieron cargar:</strong>
              <ul>
                {hecho.fallidos.slice(0, 10).map((f, i) => (
                  <li key={`${f.nombre}-${i}`}>
                    {f.nombre || '(sin nombre)'} — {f.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="acciones">
            <button className="btn btn-primario" onClick={onCerrar}>
              Listo
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Importar equipos desde una carpeta" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        <p className="texto-suave">
          Elegí la carpeta con las fotos de la planta. Cada subcarpeta se toma como el sector y
          cada nombre de archivo como el nombre del equipo.{' '}
          <strong>Las fotos todavía no se suben</strong>: eso viene en la fase siguiente.
        </p>

        <label className="campo">
          Carpeta
          <input
            type="file"
            onChange={elegirCarpeta}
            // No están en los tipos de React, pero son los atributos que hacen
            // que el navegador deje elegir una carpeta entera.
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
        </label>

        {detectar.isPending && <Cargando />}
        {detectar.error && <MensajeError error={detectar.error} />}

        {deteccion && (
          <>
            <div className="cifras-importacion">
              <span>
                <b>{deteccion.equipos.length}</b> detectados
              </span>
              <span>
                <b>{deteccion.ubicaciones.length}</b> sectores
              </span>
              <span>
                <b>{deteccion.descartados.length}</b> descartados
              </span>
              <span>
                <b>{seleccionados.length}</b> se importan
              </span>
            </div>

            {hayAdvertencias && (
              <div className="alerta alerta-aviso">
                Las filas con advertencia vienen <strong>destildadas</strong>. Es más seguro
                dejarlas afuera y cargarlas a mano que importar algo repetido. Revisalas y tildá
                las que sí quieras.
              </div>
            )}

            <div className="tabla-scroll tabla-cards-contenedor" style={{ maxHeight: 400 }}>
              <table className="tabla tabla-cards">
                <thead>
                  <tr>
                    <th>Importar</th>
                    <th>Equipo</th>
                    <th>Sector</th>
                    <th>Advertencias</th>
                  </tr>
                </thead>
                <tbody>
                  {deteccion.equipos.map((eq) => (
                    <tr
                      key={eq.ruta}
                      className={descartadas.has(eq.ruta) ? 'fila-inactiva' : undefined}
                    >
                      <td data-etiqueta="Importar">
                        <input
                          type="checkbox"
                          checked={!descartadas.has(eq.ruta)}
                          onChange={() => alternar(eq.ruta)}
                          aria-label={`Importar ${eq.nombre}`}
                        />
                      </td>
                      <td data-etiqueta="Equipo">{eq.nombre}</td>
                      <td data-etiqueta="Sector">{eq.ubicacion}</td>
                      <td data-etiqueta="Advertencias">
                        {eq.advertencias.map((a) => (
                          <span
                            key={a}
                            className="etiqueta etiqueta-aviso"
                            title={EXPLICACION_ADVERTENCIA[a]}
                          >
                            {ETIQUETA_ADVERTENCIA[a]}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {deteccion.descartados.length > 0 && (
              <details>
                <summary className="texto-suave texto-chico">
                  Ver por qué se descartaron {deteccion.descartados.length} archivos
                </summary>
                <ul className="texto-suave texto-chico">
                  {Object.entries(
                    deteccion.descartados.reduce<Record<string, number>>((acc, d) => {
                      acc[d.motivo] = (acc[d.motivo] ?? 0) + 1;
                      return acc;
                    }, {}),
                  ).map(([motivo, cuantos]) => (
                    <li key={motivo}>
                      {ETIQUETA_DESCARTE[motivo] ?? motivo}: {cuantos}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {importar.error && <MensajeError error={importar.error} />}

            <div className="acciones">
              <button className="btn" onClick={onCerrar}>
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                onClick={confirmar}
                disabled={seleccionados.length === 0 || importar.isPending}
              >
                {importar.isPending ? 'Importando…' : `Importar ${seleccionados.length} equipos`}
              </button>
            </div>

            <p className="texto-suave texto-chico">
              Se puede correr de nuevo sin problema: un equipo que ya existe con el mismo nombre
              en el mismo sector no se duplica.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
