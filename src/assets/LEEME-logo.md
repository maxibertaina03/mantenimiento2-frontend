# Logo oficial de Lácteos Las Tres

Hoy el logo se dibuja por código (`src/componentes/LogoLasTres.tsx`): es una
reconstrucción vectorial, muy parecida al original pero no idéntica —
sobre todo en la tipografía, que usa una serif genérica del sistema.

## Para usar el archivo oficial (resultado exacto)

1. Guardá el archivo en esta carpeta con el nombre **`logo-las-tres.png`**
   (o `.svg`, que es mejor porque escala sin perder nitidez).

2. En `src/componentes/LogoLasTres.tsx`, reemplazá el componente por:

   ```tsx
   import logo from '@/assets/logo-las-tres.png';

   export function LogoLasTres({ alto = 64, titulo = 'Lácteos Las Tres S.R.L.', className }: Props) {
     return <img src={logo} alt={titulo} height={alto} className={className} />;
   }
   ```

No hace falta tocar nada más: la pantalla de acceso, la barra lateral, la barra
móvil y el visor ampliado usan todos este mismo componente.

El PDF de las órdenes de compra dibuja el escudo aparte, con primitivas de jsPDF
(`src/lib/pdfOrdenCompra.ts`), porque ahí no se puede insertar un SVG.
