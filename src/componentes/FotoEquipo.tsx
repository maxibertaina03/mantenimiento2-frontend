import { useState } from 'react';
import { useCambiarFotoEquipo } from '@/api/equipos';
import { comprimirImagen, formatearBytes } from '@/lib/comprimirImagen';
import { MensajeError } from './Estados';
import type { Equipo } from '@/tipos/equipo';

/**
 * Foto de un equipo, con carga desde el celular o la computadora.
 *
 * La imagen se comprime en el navegador ANTES de subirla: las fotos de la
 * planta son de celular y pesan casi 400 KB de media, que llenarían el giga del
 * plan gratuito de Supabase en poco tiempo. Redimensionadas quedan en una
 * fracción, sin que se note en pantalla.
 */
export function FotoEquipo({ equipo }: { equipo: Equipo }) {
  const cambiar = useCambiarFotoEquipo();
  const [comprimiendo, setComprimiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [ahorro, setAhorro] = useState<string | null>(null);

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setErrorLocal(null);
    setAhorro(null);
    setComprimiendo(true);
    try {
      const img = await comprimirImagen(archivo);
      await cambiar.mutateAsync({
        id: equipo.id,
        imagenBase64: img.base64,
        nombreArchivo: img.nombreArchivo,
      });
      setAhorro(`${formatearBytes(img.bytesOriginales)} → ${formatearBytes(img.bytesFinales)}`);
    } catch (error) {
      setErrorLocal(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
    } finally {
      setComprimiendo(false);
      // Permite volver a elegir el mismo archivo si algo falló.
      e.target.value = '';
    }
  };

  const ocupado = comprimiendo || cambiar.isPending;

  return (
    <div className="campo">
      <label>Foto</label>

      {equipo.fotoUrl ? (
        <img
          src={equipo.fotoUrl}
          alt={equipo.nombre}
          className="foto-equipo"
          loading="lazy"
        />
      ) : (
        <div className="foto-equipo foto-equipo-vacia">Sin foto</div>
      )}

      <input type="file" accept="image/*" onChange={elegir} disabled={ocupado} />

      {comprimiendo && <span className="texto-suave texto-chico">Achicando la imagen…</span>}
      {cambiar.isPending && <span className="texto-suave texto-chico">Subiendo…</span>}
      {ahorro && <span className="texto-suave texto-chico">Subida: {ahorro}</span>}
      {errorLocal && <div className="alerta alerta-error">⚠️ {errorLocal}</div>}
      {cambiar.error && <MensajeError error={cambiar.error} />}
    </div>
  );
}
