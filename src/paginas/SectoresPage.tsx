import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSectores } from '@/api/sectores';
import { Cargando, EstadoVacio, MensajeError } from '@/componentes/Estados';
import { formatearFechaSola, formatearNumero } from '@/lib/formato';

/**
 * Los sectores de la planta, con sus trabajos.
 *
 * La ficha de una máquina cuenta lo que se le hizo a esa máquina. Pero hay
 * trabajos que son de un lugar —la instalación eléctrica del Saladero, pintar
 * la Caldera— y esos tienen su historial acá, junto con lo de las máquinas que
 * están en cada sector.
 */
export function SectoresPage() {
  const { data, isLoading, error } = useSectores();
  const [buscar, setBuscar] = useState('');

  const texto = buscar.trim().toLocaleLowerCase('es');
  const sectores = (data ?? []).filter(
    (s) => !texto || s.nombre.toLocaleLowerCase('es').includes(texto),
  );

  return (
    <div className="pagina">
      <div className="cabecera-pagina">
        <div>
          <h1>Sectores</h1>
          <p className="texto-suave">
            Los trabajos de cada sector de la planta: los hechos sobre el sector y los de sus
            máquinas.
          </p>
        </div>
      </div>

      <div className="buscador">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar un sector…"
          aria-label="Buscar un sector"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      {isLoading && <Cargando />}
      {error && <MensajeError error={error} />}
      {data && sectores.length === 0 && (
        <EstadoVacio>
          {texto ? 'Ningún sector coincide con la búsqueda.' : 'No hay sectores de planta cargados.'}
        </EstadoVacio>
      )}

      <div className="grilla-sectores">
        {sectores.map((s) => {
          const horas = s.horasParadaDelSector + s.horasParadaDeSusMaquinas;
          return (
            <Link key={s.id} to={`/sectores/${s.id}`} className="panel tarjeta-sector">
              <span className="tarjeta-sector-titulo">
                <MapPin className="icono" aria-hidden />
                <strong>{s.nombre}</strong>
              </span>
              <span className="texto-suave texto-chico">
                {s.maquinas === 1 ? '1 máquina' : `${s.maquinas} máquinas`}
              </span>
              <span className="tarjeta-sector-numeros">
                <span>
                  <b>{s.trabajosDelSector}</b> del sector
                </span>
                <span>
                  <b>{s.trabajosDeSusMaquinas}</b> en sus máquinas
                </span>
                {horas > 0 && (
                  <span>
                    <b>{formatearNumero(horas)}</b> h parada en el año
                  </span>
                )}
              </span>
              <span className="texto-suave texto-chico">
                {s.ultimoTrabajo
                  ? `Último: ${s.ultimoTrabajo.titulo} · ${formatearFechaSola(s.ultimoTrabajo.fecha)}`
                  : 'Sin trabajos registrados'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
