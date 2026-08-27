/**
 * Logo de Lácteos Las Tres S.R.L. — reconstrucción vectorial del isologo.
 *
 * Proporciones tomadas del original: "LAS TRES" es MUCHO más ancho que el
 * escudo (≈2,4 veces), y es esa línea la que define el ancho del logo. Cuando
 * el lienzo se dimensionaba por el escudo, el conjunto se veía chico y perdido.
 *
 * Los textos usan `textLength` + `lengthAdjust` para que el ancho no dependa de
 * la fuente instalada en cada equipo (sin eso "LAS TRES" se desbordaba y
 * quedaba cortado).
 *
 * Si tenés el archivo oficial, ver LogoImagen más abajo: alcanza con dejarlo en
 * `src/assets/` y el sistema entero lo toma.
 */

const ROJO = '#C8102E';
/** Marrón del original para "LÁCTEOS" y "EST. 1989" (no son rojos). */
const MARRON = '#3F2318';

// El lienzo lo define el ancho de "LAS TRES".
const ANCHO = 320;
const ALTO = 292;
const CENTRO = ANCHO / 2;

/**
 * Contorno del escudo: lados rectos, esquinas superiores redondeadas y base
 * en U (semicircunferencia). `inset` permite dibujar las capas concéntricas
 * (borde rojo → hueco blanco → cuerpo rojo) sin repetir el path a mano.
 */
function escudo(inset: number): string {
  const x0 = 100 + inset;
  const x1 = 220 - inset;
  const yTop = 8 + inset;
  const r = (x1 - x0) / 2;
  // La base sube junto con el inset, así que el punto donde arranca la U no cambia.
  const yBase = 94;
  return `M ${x0} ${yTop + 6} A 6 6 0 0 1 ${x0 + 6} ${yTop} H ${x1 - 6} A 6 6 0 0 1 ${x1} ${yTop + 6} V ${yBase} A ${r} ${r} 0 0 1 ${x0} ${yBase} Z`;
}

interface Props {
  /** Alto en píxeles; el ancho se calcula manteniendo la proporción. */
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
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      height={alto}
      width={(alto * ANCHO) / ALTO}
      role="img"
      aria-label={titulo}
      className={className}
      data-testid="logo-las-tres"
    >
      <title>{titulo}</title>

      <defs>
        <symbol id="estrella-lt" viewBox="-10 -10 20 20">
          <path
            d="M0,-10 L2.94,-4.05 L9.51,-3.09 L4.76,1.55 L5.88,8.09 L0,5 L-5.88,8.09 L-4.76,1.55 L-9.51,-3.09 L-2.94,-4.05 Z"
            fill="#fff"
          />
        </symbol>

        {/* Arco sobre el que se apoya "LÁCTEOS". */}
        <path id="arco-lacteos-lt" d="M 62 208 Q 160 168 258 208" fill="none" />

        {/* El paisaje interior no puede salirse del cuerpo del escudo. */}
        <clipPath id="cuerpo-escudo-lt">
          <path d={escudo(9)} />
        </clipPath>
      </defs>

      {/* Escudo: borde rojo, hueco blanco, cuerpo rojo. */}
      <path d={escudo(0)} fill={ROJO} />
      <path d={escudo(4)} fill="#fff" />
      <path d={escudo(9)} fill={ROJO} />

      {/* Tres estrellas: la del centro es más grande, como en el original. */}
      <use href="#estrella-lt" x="118" y="42" width="26" height="26" />
      <use href="#estrella-lt" x="145" y="30" width="34" height="34" />
      <use href="#estrella-lt" x="180" y="42" width="26" height="26" />

      {/* Paisaje: franja diagonal y loma, recortados al cuerpo del escudo. */}
      <g clipPath="url(#cuerpo-escudo-lt)">
        {/* Franja diagonal blanca de abajo-izquierda a arriba-derecha. */}
        <path d="M 100 122 L 224 84 L 224 96 L 100 134 Z" fill="#fff" />
        {/* Loma: media circunferencia apoyada sobre la franja. */}
        <path d="M 133 100 A 27 27 0 0 1 187 88 L 187 100 Z" fill="#fff" />
        <path
          d="M 133 101 A 27 27 0 0 1 187 89"
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>

      {/* "LÁCTEOS" en arco, en marrón. */}
      <text
        fill={MARRON}
        fontSize="27"
        fontWeight="600"
        letterSpacing="7"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        <textPath href="#arco-lacteos-lt" startOffset="50%" textAnchor="middle">
          LÁCTEOS
        </textPath>
      </text>

      {/* "EST. 1989", también en marrón. */}
      <text
        x={CENTRO}
        y="216"
        fill={MARRON}
        fontSize="14"
        fontWeight="600"
        textAnchor="middle"
        textLength="76"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        EST. 1989
      </text>

      {/* "LAS TRES": la línea que define el ancho del logo. */}
      <text
        x={CENTRO}
        y="262"
        fill={ROJO}
        fontSize="62"
        fontWeight="700"
        textAnchor="middle"
        textLength="300"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        LAS TRES
      </text>

      {/* "S.R.L." centrado debajo. */}
      <text
        x={CENTRO}
        y="284"
        fill={ROJO}
        fontSize="15"
        fontWeight="600"
        letterSpacing="3"
        textAnchor="middle"
        textLength="48"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        SRL
      </text>
    </svg>
  );
}
