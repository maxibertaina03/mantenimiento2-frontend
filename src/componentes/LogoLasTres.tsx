/**
 * Logo de Lácteos Las Tres S.R.L. (reconstrucción vectorial del isologo).
 *
 * Detalle importante: los textos usan `textLength` + `lengthAdjust`, que obliga
 * al navegador a encajar cada línea en un ancho fijo. Sin eso, el ancho real
 * depende de la fuente disponible en cada equipo y "LAS TRES" se desbordaba del
 * viewBox, quedando cortado ("AS TRES"). Con textLength el logo se ve igual en
 * cualquier máquina.
 *
 * El isologo original es blanco sobre fondo oscuro; acá el texto va en rojo
 * institucional porque siempre se muestra sobre panel blanco (.panel-logo).
 *
 * Si conseguís el archivo oficial (SVG/PNG), reemplazá solo este componente.
 */

const ROJO = '#C8102E';

interface Props {
  /** Alto en píxeles. El ancho se calcula manteniendo la proporción. */
  alto?: number;
  titulo?: string;
  className?: string;
}

// Proporciones del lienzo. Todo se dibuja dentro de estas medidas.
const ANCHO = 240;
const ALTO = 296;
const CENTRO = ANCHO / 2;

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

        {/* Arco sobre el que se apoya "LÁCTEOS" (peak en el centro). */}
        <path id="arco-lacteos-lt" d="M 46 214 Q 120 186 194 214" fill="none" />

        {/* Recorta la banda curva para que no se salga del escudo. */}
        <clipPath id="recorte-escudo-lt">
          <path d="M78 12 H162 A10 10 0 0 1 172 22 V92 C172 124 150 148 120 162 C90 148 68 124 68 92 V22 A10 10 0 0 1 78 12 Z" />
        </clipPath>
      </defs>

      {/* Escudo */}
      <path
        d="M78 12 H162 A10 10 0 0 1 172 22 V92 C172 124 150 148 120 162 C90 148 68 124 68 92 V22 A10 10 0 0 1 78 12 Z"
        fill={ROJO}
      />

      {/* Tres estrellas */}
      <use href="#estrella-lt" x="82" y="34" width="24" height="24" />
      <use href="#estrella-lt" x="108" y="28" width="24" height="24" />
      <use href="#estrella-lt" x="134" y="34" width="24" height="24" />

      {/* Banda curva (el campo del isologo) */}
      <g clipPath="url(#recorte-escudo-lt)">
        <path
          d="M60 118 C 84 92, 122 92, 148 116 C 162 129, 172 138, 182 143 L182 170 L60 170 Z"
          fill={ROJO}
        />
        <path
          d="M60 110 C 84 84, 122 84, 148 108 C 162 121, 172 130, 182 135"
          fill="none"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>

      {/* "LÁCTEOS" siguiendo el arco */}
      <text
        fill={ROJO}
        fontSize="19"
        fontWeight="600"
        letterSpacing="4"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        <textPath href="#arco-lacteos-lt" startOffset="50%" textAnchor="middle">
          LÁCTEOS
        </textPath>
      </text>

      {/* "EST. 1989" */}
      <text
        x={CENTRO}
        y="230"
        fill={ROJO}
        fontSize="11"
        fontWeight="500"
        textAnchor="middle"
        textLength="62"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        EST. 1989
      </text>

      {/* "LAS TRES": el textLength garantiza que nunca se corte. */}
      <text
        x={CENTRO}
        y="270"
        fill={ROJO}
        fontSize="44"
        fontWeight="800"
        textAnchor="middle"
        textLength="196"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        LAS TRES
      </text>

      {/* "S.R.L." */}
      <text
        x="196"
        y="288"
        fill={ROJO}
        fontSize="12"
        fontWeight="600"
        textAnchor="middle"
        textLength="34"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        S.R.L.
      </text>
    </svg>
  );
}

/** Logo sobre panel blanco: el isologo es rojo y necesita fondo claro. */
export function LogoEnPanel({ alto = 64 }: { alto?: number }) {
  return (
    <div className="panel-logo">
      <LogoLasTres alto={alto} />
    </div>
  );
}
