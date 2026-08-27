/**
 * Sticker de herramientas: identifica visualmente al sistema como
 * "gestión de mantenimiento". Llave inglesa y destornillador cruzados sobre un
 * engranaje, en un círculo.
 *
 * Es decorativo: se marca aria-hidden para que los lectores de pantalla no lo
 * anuncien (el texto que lo acompaña ya dice de qué se trata).
 */

interface Props {
  /** Diámetro en píxeles. */
  tamano?: number;
  className?: string;
}

export function StickerHerramientas({ tamano = 96, className }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      focusable="false"
      className={className}
      data-testid="sticker-herramientas"
    >
      <defs>
        <linearGradient id="fondo-sticker" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
      </defs>

      {/* Disco */}
      <circle cx="60" cy="60" r="56" fill="url(#fondo-sticker)" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />

      {/* Engranaje de fondo */}
      <g opacity="0.28" fill="#fff">
        <circle cx="60" cy="60" r="27" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="55.5"
            y="24"
            width="9"
            height="13"
            rx="2"
            transform={`rotate(${i * 45} 60 60)`}
          />
        ))}
      </g>
      <circle cx="60" cy="60" r="17" fill="url(#fondo-sticker)" />

      {/* Llave inglesa y destornillador cruzados */}
      <g
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Llave: mango en diagonal + boca abierta arriba */}
        <path d="M44 78 L72 50" />
        <path d="M78 34 a12 12 0 1 0 8 20 l-6 -6 4 -10 z" fill="#fff" strokeWidth="4" />

        {/* Destornillador: mango grueso abajo-derecha, punta arriba-izquierda */}
        <path d="M76 78 L52 54" />
        <path d="M46 48 l-8 -8" strokeWidth="9" />
      </g>
    </svg>
  );
}
