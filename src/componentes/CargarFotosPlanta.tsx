import { useRef, useState } from 'react';
import { useCambiarFotoEquipo, useEquipos } from '@/api/equipos';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { emparejarFotos, type ResultadoEmparejado } from '@/lib/emparejarFotos';
import { Cargando, MensajeError } from './Estados';
import { Modal } from './Modal';

/** Tope de equipos a traer. Hoy son 326; con margen para que crezcan. */
const LIMITE_EQUIPOS = 1000;

/** Cuántas fotos se suben a la vez. */
const EN_PARALELO = 3;

interface Progreso {
  hechas: number;
  total: number;
  actual: string;
  fallidas: { nombre: string; motivo: string }[];
}

/**
 * Carga las fotos de todas las máquinas de una vez, desde la carpeta.
 *
 * Existe porque subirlas de a una es inviable: son 326 equipos, y las fotos ya
 * están todas en la misma carpeta de la que salieron los equipos, ordenadas por
 * sector. El nombre del archivo es el nombre del equipo.
 *
 * Las imágenes se achican en el navegador antes de subir, igual que en la ficha:
 * las 522 originales pesan 190 MB y no entrarían en el plan gratuito de
 * Supabase. Achicadas quedan en una fracción sin que se note en pantalla.
 *
 * Sube de a tres a la vez: de a una tarda demasiado, y todas juntas satura al
 * servidor, que en el plan gratuito tiene poca memoria.
 */
export function CargarFotosPlanta({ onCerrar }: { onCerrar: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const { data, isLoading, error } = useEquipos(1, LIMITE_EQUIPOS);
  const cambiarFoto = useCambiarFotoEquipo();

  const [resultado, setResultado] = useState<ResultadoEmparejado | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [terminado, setTerminado] = useState(false);

  const equipos = data?.datos ?? [];

  const alElegirCarpeta = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(ev.target.files ?? []);
    setTerminado(false);
    setProgreso(null);
    setResultado(emparejarFotos(archivos, equipos));
  };

  /** Las que se van a subir según la casilla de reemplazar. */
  const aSubir = (resultado?.emparejadas ?? []).filter((e) => reemplazar || !e.yaTeniaFoto);

  const subir = async () => {
    const fallidas: { nombre: string; motivo: string }[] = [];
    let hechas = 0;
    setProgreso({ hechas: 0, total: aSubir.length, actual: '', fallidas });

    // Se avanza de a tres tomando de una cola compartida: así una foto pesada
    // no frena a las otras dos, y nunca hay más de tres subidas en vuelo.
    const cola = [...aSubir];
    const trabajador = async () => {
      for (;;) {
        const item = cola.shift();
        if (!item) return;
        setProgreso({ hechas, total: aSubir.length, actual: item.equipo.nombre, fallidas });
        try {
          const img = await comprimirImagen(item.archivo);
          await cambiarFoto.mutateAsync({
            id: item.equipo.id,
            imagenBase64: img.base64,
            nombreArchivo: img.nombreArchivo,
          });
        } catch (e) {
          fallidas.push({
            nombre: item.equipo.nombre,
            motivo: e instanceof Error ? e.message : 'no se pudo subir',
          });
        }
        hechas += 1;
        setProgreso({ hechas, total: aSubir.length, actual: item.equipo.nombre, fallidas });
      }
    };

    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));
    setTerminado(true);
  };

  const subiendo = progreso !== null && !terminado;

  return (
    <Modal titulo="Cargar fotos desde la carpeta" abierto tamano="ancho" onCerrar={onCerrar}>
      <div className="formulario-modal">
        {isLoading && <Cargando />}
        {error && <MensajeError error={error} />}

        {!resultado && data && (
          <>
            <p className="texto-suave texto-chico">
              Elegí la carpeta con las fotos de las máquinas. Cada foto se asigna al equipo cuyo
              nombre coincide con el del archivo, dentro de su sector. Las carpetas{' '}
              <strong>Taller</strong> y <strong>manuales</strong> se saltean: no son sectores de la
              planta.
            </p>
            <p className="texto-suave texto-chico">
              No sale nada de tu equipo hasta que confirmes: primero se muestra qué se encontró.
            </p>
            <div className="acciones-envio">
              <button className="btn btn-primario" onClick={() => entrada.current?.click()}>
                📁 Elegir la carpeta
              </button>
            </div>
            <input
              ref={entrada}
              type="file"
              multiple
              accept="image/*"
              hidden
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={alElegirCarpeta}
            />
          </>
        )}

        {resultado && !progreso && (
          <>
            <div className="resumen-mantenimiento">
              <span>
                <b>{resultado.emparejadas.length}</b> fotos reconocidas
              </span>
              {resultado.sinEquipo.length > 0 && (
                <span>
                  <b>{resultado.sinEquipo.length}</b> sin equipo
                </span>
              )}
              {resultado.equiposSinArchivo.length > 0 && (
                <span>
                  <b>{resultado.equiposSinArchivo.length}</b> equipos sin foto
                </span>
              )}
            </div>

            <label className="filtro-check">
              <input
                type="checkbox"
                checked={reemplazar}
                onChange={(e) => setReemplazar(e.target.checked)}
              />
              Reemplazar también las que ya tienen foto cargada
            </label>

            {aSubir.length === 0 ? (
              <div className="alerta alerta-aviso">
                No hay nada para subir. Todas las máquinas reconocidas ya tienen su foto; tildá la
                casilla de arriba si querés reemplazarlas.
              </div>
            ) : (
              <p className="texto-suave texto-chico">
                Se van a subir <strong>{aSubir.length}</strong> fotos. Cada una se achica en tu
                navegador antes de salir, así que tarda un rato. No cierres esta ventana.
              </p>
            )}

            {resultado.sinEquipo.length > 0 && (
              <>
                <h3 className="subtitulo-form">Archivos sin equipo</h3>
                <p className="texto-suave texto-chico">
                  No hay ninguna máquina con ese nombre. Suelen ser fotos con nombre automático del
                  celular, o máquinas que todavía no están cargadas.
                </p>
                <ul className="lista-catalogo lista-etiquetas">
                  {resultado.sinEquipo.slice(0, 40).map((a) => (
                    <li key={`${a.sector}-${a.nombre}`}>
                      <span>{a.nombre}</span>
                      <span className="texto-suave texto-chico">{a.sector ?? 'sin sector'}</span>
                    </li>
                  ))}
                </ul>
                {resultado.sinEquipo.length > 40 && (
                  <p className="texto-suave texto-chico">
                    y {resultado.sinEquipo.length - 40} más.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {progreso && (
          <>
            <h3 className="subtitulo-form">{terminado ? 'Listo' : 'Subiendo…'}</h3>
            <div className="barra-progreso">
              <div
                className="barra-progreso-relleno"
                style={{
                  width: `${progreso.total === 0 ? 100 : (progreso.hechas / progreso.total) * 100}%`,
                }}
              />
            </div>
            <p className="texto-suave texto-chico">
              {progreso.hechas} de {progreso.total}
              {!terminado && progreso.actual && ` · ${progreso.actual}`}
            </p>

            {terminado && (
              <div className={progreso.fallidas.length === 0 ? 'alerta alerta-exito' : 'alerta alerta-aviso'}>
                Se subieron <strong>{progreso.hechas - progreso.fallidas.length}</strong> fotos
                {progreso.fallidas.length > 0 && (
                  <>
                    {' '}
                    y fallaron <strong>{progreso.fallidas.length}</strong>. Podés volver a entrar
                    acá: las que ya subieron no se repiten.
                  </>
                )}
                .
              </div>
            )}

            {progreso.fallidas.length > 0 && (
              <ul className="lista-catalogo lista-etiquetas">
                {progreso.fallidas.map((f) => (
                  <li key={f.nombre}>
                    <span>{f.nombre}</span>
                    <span className="texto-suave texto-chico">{f.motivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="acciones">
          <button className="btn" onClick={onCerrar} disabled={subiendo}>
            {terminado ? 'Listo' : 'Cerrar'}
          </button>
          {resultado && !progreso && aSubir.length > 0 && (
            <button className="btn btn-primario" onClick={subir}>
              ⬆ Subir {aSubir.length} fotos
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
