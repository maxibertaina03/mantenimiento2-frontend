import {
  MARRON_LAS_TRES,
  PATHS_MARRON,
  PATHS_ROJO,
  ROJO_LAS_TRES,
  TRANSFORM_TRAZADO,
  VIEWBOX,
} from './logoPaths';

/**
 * Logo oficial de Lácteos Las Tres S.R.L.
 *
 * Usa el archivo real (`src/assets/logo.svg`), no una reconstrucción. Ese
 * archivo es un trazado monocromo, así que los paths se pintan acá según a qué
 * parte del logo pertenecen (ver logoPaths.ts).
 *
 * Va inline y no como <img> justamente por eso: un <img> no permite colorear
 * el contenido, y el archivo saldría todo negro.
 */

interface Props {
  /** Alto en píxeles. El logo es cuadrado, así que el ancho es el mismo. */
  alto?: number;
  titulo?: string;
  className?: string;
}

export function LogoLasTres({
  alto = 64,
  titulo = 'Lácteos Las Tres S.R.L.',
  className,
}: Props) {
  return (
    <svg
      viewBox={VIEWBOX}
      height={alto}
      width={alto}
      role="img"
      aria-label={titulo}
      className={className}
      data-testid="logo-las-tres"
    >
      <title>{titulo}</title>
      <g transform={TRANSFORM_TRAZADO} stroke="none">
        <g fill={ROJO_LAS_TRES}>
          {PATHS_ROJO.map((d, i) => (
            <path key={`r${i}`} d={d} />
          ))}
        </g>
        <g fill={MARRON_LAS_TRES}>
          {PATHS_MARRON.map((d, i) => (
            <path key={`m${i}`} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** El mismo logo como cadena SVG, para rasterizarlo en el PDF. */
export function logoComoSvg(): string {
  const grupo = (paths: string[], color: string) =>
    `<g fill="${color}">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="512" height="512">` +
    `<g transform="${TRANSFORM_TRAZADO}" stroke="none">` +
    grupo(PATHS_ROJO, ROJO_LAS_TRES) +
    grupo(PATHS_MARRON, MARRON_LAS_TRES) +
    `</g></svg>`
  );
}
