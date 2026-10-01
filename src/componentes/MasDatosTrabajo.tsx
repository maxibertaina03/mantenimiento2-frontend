import { useState } from 'react';
import { CampoNumero } from './CampoNumero';
import { ComboProveedor } from './ComboProveedor';
import { faltaElProveedor, type DatosDelTrabajo } from '@/lib/datosDelTrabajo';
import { EJECUTORES, ETIQUETA_EJECUTOR, type Ejecutor } from '@/tipos/ordenTrabajo';

/**
 * «+ Más datos»: quién lo hizo —la planta o un servicio externo, y cuál—, el
 * costo de mano de obra y las horas de parada.
 *
 * Es el mismo bloque al registrar un trabajo en la ficha de un equipo, al
 * cerrar una orden de trabajo y al dar por hecha una tarea del calendario: un
 * trabajo puede mandarse afuera venga por donde venga, y antes solo se podía
 * decir desde Equipos.
 *
 * Plegado: el que solo anota que cambió un retén no necesita ver esto.
 */
export function MasDatosTrabajo({
  datos,
  onCambio,
}: {
  datos: DatosDelTrabajo;
  onCambio: (datos: DatosDelTrabajo) => void;
}) {
  // Si ya se eligió algo (volver a abrir el formulario con datos), se muestra abierto.
  const [abierto, setAbierto] = useState(datos.ejecutor === 'EXTERNO');
  const cambiar = (cambio: Partial<DatosDelTrabajo>) => onCambio({ ...datos, ...cambio });

  return (
    <>
      <div>
        <button type="button" className="btn btn-sm" onClick={() => setAbierto((v) => !v)}>
          {abierto ? '− Menos datos' : '+ Más datos: quién lo hizo, costo, horas de parada'}
        </button>
      </div>

      {abierto && (
        <div className="grilla-filtros">
          <label className="campo">
            Quién lo hizo
            <select
              name="ejecutor"
              value={datos.ejecutor}
              onChange={(e) => cambiar({ ejecutor: e.target.value as Ejecutor })}
            >
              {EJECUTORES.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_EJECUTOR[e]}
                </option>
              ))}
            </select>
          </label>

          {datos.ejecutor === 'EXTERNO' && (
            <label className="campo">
              Qué proveedor *
              {/* Un buscador y no un desplegable: son más de mil proveedores. */}
              <ComboProveedor onCambio={(p) => cambiar({ proveedorId: p?.id ?? '' })} />
            </label>
          )}

          <label className="campo">
            Costo de mano de obra
            <CampoNumero
              step="0.01"
              min="0"
              placeholder="opcional"
              valor={datos.costo}
              onCambio={(costo) => cambiar({ costo })}
            />
          </label>

          <label className="campo">
            Horas de parada
            <CampoNumero
              step="0.5"
              min="0"
              placeholder="opcional"
              valor={datos.horas}
              onCambio={(horas) => cambiar({ horas })}
            />
            <span className="texto-suave texto-chico">
              Lo que más cuesta de una rotura no son los repuestos.
            </span>
          </label>
        </div>
      )}

      {faltaElProveedor(datos) && abierto && (
        <p className="texto-suave texto-chico">Elegí el proveedor para poder guardar.</p>
      )}
    </>
  );
}
