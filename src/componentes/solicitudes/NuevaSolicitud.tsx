import { Camera, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCrearSolicitud, useOpcionesSolicitud } from '@/api/solicitudes';
import { MensajeError } from '@/componentes/Estados';
import { Modal } from '@/componentes/Modal';
import { comprimirImagen } from '@/lib/comprimirImagen';
import {
  ETIQUETA_URGENCIA,
  MAX_FOTOS_SOLICITUD,
  URGENCIAS,
  type Solicitud,
  type Urgencia,
} from '@/tipos/solicitud';

interface FotoElegida {
  vista: string;
  imagenBase64: string;
  nombreArchivo: string;
}

/**
 * Cargar una solicitud de trabajo: qué pasa, dónde, qué tan urgente y, si
 * ayuda, fotos.
 *
 * Pensado para el celular, que es donde está quien ve el problema: campos
 * grandes y la cámara directa. Las fotos se achican en el teléfono antes de
 * mandarlas, así suben rápido aunque la señal de la planta sea mala.
 */
export function NuevaSolicitud({
  onCreada,
  onCerrar,
}: {
  onCreada: (s: Solicitud) => void;
  onCerrar: () => void;
}) {
  const { data: opciones, isLoading, error } = useOpcionesSolicitud();
  const crear = useCrearSolicitud();
  const [sectorId, setSectorId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState<Urgencia>('NORMAL');
  const [fotos, setFotos] = useState<FotoElegida[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  // El sector de quien la carga viene elegido.
  useEffect(() => {
    if (opciones?.miSectorId && !sectorId) setSectorId(opciones.miSectorId);
  }, [opciones, sectorId]);
  // Las vistas previas se liberan al cerrar, no cada vez que cambia la lista.
  const vistas = useRef<string[]>([]);
  useEffect(() => () => vistas.current.forEach((v) => URL.revokeObjectURL(v)), []);

  const sector = useMemo(
    () => opciones?.sectores.find((s) => s.id === sectorId) ?? null,
    [opciones, sectorId],
  );

  const agregarFotos = async (archivos: FileList | null) => {
    if (!archivos) return;
    setErrorFoto(null);
    setProcesando(true);
    try {
      const nuevas: FotoElegida[] = [];
      for (const archivo of [...archivos].slice(0, MAX_FOTOS_SOLICITUD - fotos.length)) {
        if (!archivo.type.startsWith('image/')) continue;
        const comprimida = await comprimirImagen(archivo, { lado: 1280, calidad: 0.75 });
        const vista = URL.createObjectURL(archivo);
        vistas.current.push(vista);
        nuevas.push({
          vista,
          imagenBase64: comprimida.base64,
          nombreArchivo: comprimida.nombreArchivo,
        });
      }
      setFotos((actuales) => [...actuales, ...nuevas]);
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : 'No se pudo leer la foto.');
    } finally {
      setProcesando(false);
    }
  };

  const listo = sectorId && descripcion.trim().length >= 5 && !procesando;

  const enviar = async () => {
    const creada = await crear.mutateAsync({
      descripcion: descripcion.trim(),
      sectorId,
      equipoId: equipoId || undefined,
      urgencia,
      fotos: fotos.map(({ imagenBase64, nombreArchivo }) => ({ imagenBase64, nombreArchivo })),
    });
    onCreada(creada);
  };

  return (
    <Modal titulo="Nueva solicitud de trabajo" abierto onCerrar={onCerrar}>
      <div className="formulario-modal nueva-solicitud">
        {isLoading && <p className="texto-suave">Cargando sectores…</p>}
        {error && <MensajeError error={error} />}

        <label className="campo">
          Sector
          <select
            value={sectorId}
            onChange={(e) => {
              setSectorId(e.target.value);
              setEquipoId('');
            }}
          >
            <option value="">Elegí el sector</option>
            {opciones?.sectores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        {sector && sector.equipos.length > 0 && (
          <label className="campo">
            Máquina <span className="texto-suave texto-chico">(si es sobre una)</span>
            <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
              <option value="">No es de una máquina / no sé</option>
              {sector.equipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="campo">
          ¿Qué pasa?
          <textarea
            rows={4}
            maxLength={1000}
            placeholder="Ej.: pierde agua la llave de la tina 2 desde esta mañana"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        <fieldset className="campo urgencia-solicitud">
          <legend>¿Qué tan urgente es?</legend>
          <div className="atajos-filtro">
            {URGENCIAS.map((u) => (
              <label key={u} className={`casilla urgencia-${u.toLowerCase()}`}>
                <input
                  type="radio"
                  name="urgencia"
                  value={u}
                  checked={urgencia === u}
                  onChange={() => setUrgencia(u)}
                />
                {ETIQUETA_URGENCIA[u]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="campo">
          <span>
            Fotos <span className="texto-suave texto-chico">(opcional, hasta {MAX_FOTOS_SOLICITUD})</span>
          </span>
          <div className="fotos-solicitud">
            {fotos.map((f, i) => (
              <div key={f.vista} className="foto-solicitud">
                <img src={f.vista} alt={`Foto ${i + 1}`} />
                <button
                  type="button"
                  className="btn btn-sm foto-solicitud-quitar"
                  aria-label={`Quitar la foto ${i + 1}`}
                  onClick={() => setFotos((fs) => fs.filter((x) => x !== f))}
                >
                  <X className="icono" aria-hidden />
                </button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS_SOLICITUD && (
              <label className="btn foto-solicitud-agregar">
                <Camera className="icono" aria-hidden />
                {procesando ? 'Preparando…' : 'Sacar o elegir foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  hidden
                  onChange={(e) => {
                    void agregarFotos(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          {errorFoto && <div className="alerta alerta-aviso">{errorFoto}</div>}
        </div>

        {crear.error && <MensajeError error={crear.error} />}
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primario"
            disabled={!listo || crear.isPending}
            onClick={() => void enviar()}
          >
            <Send className="icono" aria-hidden />
            {crear.isPending ? 'Enviando…' : 'Enviar a mantenimiento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
