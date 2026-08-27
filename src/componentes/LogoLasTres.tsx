/**
 * Logo de Lácteos Las Tres S.R.L.
 *
 * Es una reconstrucción vectorial del isologo (escudo con tres estrellas +
 * "LÁCTEOS LAS TRES"). Está en SVG para que escale sin perder nitidez y para
 * poder pintar el texto según el fondo.
 *
 * El logo original es blanco sobre fondo oscuro; sobre fondo claro ese texto
 * desaparecería, así que acá el texto se pinta en rojo institucional y solo los
 * detalles DENTRO del escudo quedan en blanco (que es donde contrastan).
 *
 * Si tenés el archivo oficial (SVG/PNG), reemplazá este componente por un
 * <img src={...} /> apuntando al asset: el resto del sistema lo usa por nombre.
 */

const ROJO = '#C8102E';

interface Props {
  /** Alto en píxeles. El ancho se calcula solo. */
  alto?: number;
  /** Texto alternativo accesible. */
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
      viewBox="0 0 200 260"
      height={alto}
      width={(alto * 200) / 260}
      role="img"
      aria-label={titulo}
      className={className}
      data-testid="logo-las-tres"
    >
      <title>{titulo}</title>

      <defs>
        {/* Estrella de cinco puntas reutilizable, centrada en el origen. */}
        <symbol id="estrella" viewBox="-10 -10 20 20">
          <path
            d="M0,-10 L2.94,-4.05 L9.51,-3.09 L4.76,1.55 L5.88,8.09 L0,5 L-5.88,8.09 L-4.76,1.55 L-9.51,-3.09 L-2.94,-4.05 Z"
            fill="#fff"
          />
        </symbol>

        {/* Guía para el texto "LÁCTEOS" en arco. */}
        <path id="arco-lacteos" d="M 28 196 A 74 44 0 0 1 172 196" fill="none" />

        {/* Recorta el escudo para que la banda curva no se salga del borde. */}
        <clipPath id="recorte-escudo">
          <path d="M40 10 H160 A8 8 0 0 1 168 18 V80 C168 114 140 142 100 158 C60 142 32 114 32 80 V18 A8 8 0 0 1 40 10 Z" />
        </clipPath>
      </defs>

      {/* Escudo */}
      <path
        d="M40 10 H160 A8 8 0 0 1 168 18 V80 C168 114 140 142 100 158 C60 142 32 114 32 80 V18 A8 8 0 0 1 40 10 Z"
        fill={ROJO}
      />

      {/* Tres estrellas */}
      <use href="#estrella" x="52" y="34" width="26" height="26" />
      <use href="#estrella" x="87" y="28" width="26" height="26" />
      <use href="#estrella" x="122" y="34" width="26" height="26" />

      {/* Banda curva (el campo/la loma del isologo original) */}
      <g clipPath="url(#recorte-escudo)">
        <path
          d="M20 120 C 55 86, 105 86, 140 118 C 158 134, 172 146, 186 152 L186 172 L20 172 Z"
          fill={ROJO}
        />
        <path
          d="M20 112 C 55 78, 105 78, 140 110 C 158 126, 172 138, 186 144"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>

      {/* "LÁCTEOS" en arco */}
      <text
        fill={ROJO}
        fontSize="19"
        fontWeight="600"
        letterSpacing="5"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        <textPath href="#arco-lacteos" startOffset="50%" textAnchor="middle">
          LÁCTEOS
        </textPath>
      </text>

      {/* "EST. 1989" */}
      <text
        x="100"
        y="203"
        fill={ROJO}
        fontSize="11"
        fontWeight="500"
        letterSpacing="2.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        EST. 1989
      </text>

      {/* "LAS TRES" */}
      <text
        x="100"
        y="238"
        fill={ROJO}
        fontSize="44"
        fontWeight="800"
        letterSpacing="1"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        LAS TRES
      </text>

      {/* "S.R.L." */}
      <text
        x="163"
        y="253"
        fill={ROJO}
        fontSize="12"
        fontWeight="600"
        letterSpacing="1"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        S.R.L.
      </text>
    </svg>
  );
}

/**
 * Logo sobre panel blanco. El isologo es rojo sobre claro, así que necesita
 * fondo blanco para leerse bien en cualquier parte de la app.
 */
export function LogoEnPanel({ alto = 64 }: { alto?: number }) {
  return (
    <div className="panel-logo">
      <LogoLasTres alto={alto} />
    </div>
  );
}
