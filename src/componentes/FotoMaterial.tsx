import { useState } from 'react';
import {
  useCambiarFotoMaterial,
  useFotosDeMaterialesDisponibles,
  useQuitarFotoMaterial,
} from '@/api/materiales';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { P, usePuede } from '@/lib/permisos';
import type { Material } from '@/tipos/material';
import { MensajeError } from './Estados';
import { SelectorArchivo } from './SelectorArchivo';

/**
 * La foto de un material, para reconocerlo en el estante: hay repuestos que
 * por el nombre solo no se sabe qué son.
 *
 * Igual que la de los equipos, se achica en el navegador antes de subirla.
 * Tocarla la abre en grande.
 */
export function FotoMaterial({ material }: { material: Material }) {
  const puede = usePuede();
  const { data: almacen } = useFotosDeMaterialesDisponibles();
  const cambiar = useCambiarFotoMaterial(material.id);
  const quitar = useQuitarFotoMaterial(material.id);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const puedeCargar = puede(P.MATERIALES_EDITAR) && almacen?.disponible === true;
  if (!material.fotoUrl && !puedeCargar) return null;

  const elegir = async (archivos: File[]) => {
    const archivo = archivos[0];
    if (!archivo) return;
    setErrorLocal(null);
    setComprimiendo(true);
    try {
      const img = await comprimirImagen(archivo);
      await cambiar.mutateAsync({ imagenBase64: img.base64, nombreArchivo: img.nombreArchivo });
    } catch (error) {
      setErrorLocal(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
    } finally {
      setComprimiendo(false);
    }
  };

  const sacar = () => {
    if (window.confirm('¿Sacarle la foto a este material?')) quitar.mutate();
  };

  return (
    <div className="foto-material">
      {material.fotoUrl && (
        <a href={material.fotoUrl} target="_blank" rel="noreferrer" title="Ver en grande">
          <img src={material.fotoUrl} alt={material.nombre} className="foto-equipo" />
        </a>
      )}
      {puedeCargar && (
        <>
          <SelectorArchivo
            accept="image/*"
            icono="📷"
            compacto={Boolean(material.fotoUrl)}
            titulo={material.fotoUrl ? 'Cambiar la foto' : 'Subí una foto del material'}
            ayuda="Para reconocerlo en el estante · desde el celular o la compu, se achica sola"
            ocupado={comprimiendo ? 'Achicando la imagen…' : cambiar.isPending ? 'Subiendo…' : null}
            onElegir={elegir}
          />
          {material.fotoUrl && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={quitar.isPending}
              onClick={sacar}
            >
              Sacar la foto
            </button>
          )}
        </>
      )}
      {errorLocal && <div className="alerta alerta-error">⚠️ {errorLocal}</div>}
      {cambiar.error && <MensajeError error={cambiar.error} />}
      {quitar.error && <MensajeError error={quitar.error} />}
    </div>
  );
}
