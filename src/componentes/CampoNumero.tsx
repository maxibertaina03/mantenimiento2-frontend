import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

/**
 * Input numérico que se puede escribir con naturalidad.
 *
 * El problema que resuelve: si el estado guarda un `number` y en cada tecla se
 * hace `Number(e.target.value)`, aparecen dos bugs molestos:
 *
 *  - **No se puede borrar**: al vaciar el campo, `Number('')` devuelve 0, el
 *    estado vuelve a 0 y el campo se rellena solo. Nunca queda vacío.
 *  - **Quedan ceros a la izquierda**: con un 0 en el campo, escribir 1 da "01".
 *
 * La causa de fondo es que el texto que se está tipeando no siempre es un
 * número válido todavía: "", "-", "0." y "01" son estados intermedios legítimos.
 * Por eso acá el texto vive en el componente y el número se emite solo cuando
 * se puede interpretar; al salir del campo, el texto se normaliza ("01" → "1").
 */

type PropsInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

interface Props extends PropsInput {
  /** Valor actual. `undefined` = campo vacío. */
  valor: number | undefined;
  /** Se llama con `undefined` cuando el campo queda vacío. */
  onCambio: (valor: number | undefined) => void;
}

export function CampoNumero({ valor, onCambio, ...resto }: Props) {
  const [texto, setTexto] = useState(valor === undefined ? '' : String(valor));

  // Lo último que emitimos hacia afuera. Sirve para distinguir un cambio
  // propio (no hay que tocar el texto que el usuario está escribiendo) de uno
  // externo, como el reset del formulario después de guardar.
  const ultimoEmitido = useRef(valor);

  useEffect(() => {
    if (valor !== ultimoEmitido.current) {
      setTexto(valor === undefined ? '' : String(valor));
      ultimoEmitido.current = valor;
    }
  }, [valor]);

  /** '' y textos a medio escribir ('-', '0.') no son un número todavía. */
  const aNumero = (t: string): number | undefined => {
    const limpio = t.trim();
    if (limpio === '') return undefined;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <input
      {...resto}
      type="number"
      value={texto}
      onChange={(e) => {
        const nuevoTexto = e.target.value;
        setTexto(nuevoTexto);
        const n = aNumero(nuevoTexto);
        ultimoEmitido.current = n;
        onCambio(n);
      }}
      onBlur={(e) => {
        // Al salir del campo se limpia lo cosmético: "01" queda "1", "1." → "1".
        const n = aNumero(texto);
        setTexto(n === undefined ? '' : String(n));
        resto.onBlur?.(e);
      }}
    />
  );
}
