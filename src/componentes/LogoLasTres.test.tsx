import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoLasTres } from './LogoLasTres';
import { StickerHerramientas } from './StickerHerramientas';

/**
 * El logo se veía cortado ("AS TRES" en vez de "LAS TRES") porque el ancho real
 * del texto depende de la fuente de cada equipo y se desbordaba del viewBox.
 * La solución fue fijar `textLength`, así que estos tests protegen justamente eso.
 */
describe('LogoLasTres', () => {
  it('rinde el nombre completo de la empresa', () => {
    render(<LogoLasTres />);
    expect(screen.getByRole('img', { name: /Lácteos Las Tres/i })).toBeInTheDocument();
  });

  it('REGRESION: los textos fijan textLength para no cortarse', () => {
    const { container } = render(<LogoLasTres />);
    const lasTres = [...container.querySelectorAll('text')].find(
      (t) => t.textContent?.trim() === 'LAS TRES',
    );
    expect(lasTres).toBeDefined();
    expect(lasTres?.getAttribute('textLength')).toBeTruthy();
    expect(lasTres?.getAttribute('lengthAdjust')).toBe('spacingAndGlyphs');
  });

  it('REGRESION: el texto entra dentro del viewBox', () => {
    const { container } = render(<LogoLasTres />);
    const svg = container.querySelector('svg')!;
    const [, , ancho] = svg.getAttribute('viewBox')!.split(' ').map(Number);

    for (const t of container.querySelectorAll('text[textLength]')) {
      const largo = Number(t.getAttribute('textLength'));
      const x = Number(t.getAttribute('x'));
      // Con textAnchor="middle" el texto se extiende media longitud a cada lado.
      expect(x - largo / 2).toBeGreaterThanOrEqual(0);
      expect(x + largo / 2).toBeLessThanOrEqual(ancho);
    }
  });

  it('incluye las tres estrellas, con la del centro mas grande', () => {
    const { container } = render(<LogoLasTres />);
    const estrellas = [...container.querySelectorAll('use')];
    expect(estrellas).toHaveLength(3);

    const anchos = estrellas.map((e) => Number(e.getAttribute('width')));
    // El original tiene la estrella central destacada.
    expect(anchos[1]).toBeGreaterThan(anchos[0]);
    expect(anchos[1]).toBeGreaterThan(anchos[2]);
  });

  it('REGRESION: "LACTEOS" y "EST. 1989" van en marron, no en rojo', () => {
    const { container } = render(<LogoLasTres />);
    const textos = [...container.querySelectorAll('text')];
    const lacteos = textos.find((t) => t.textContent?.includes('LÁCTEOS'));
    const est = textos.find((t) => t.textContent?.includes('EST.'));
    expect(lacteos?.getAttribute('fill')).toBe('#3F2318');
    expect(est?.getAttribute('fill')).toBe('#3F2318');
  });

  it('REGRESION: "LAS TRES" es mucho mas ancho que el escudo', () => {
    const { container } = render(<LogoLasTres />);
    const lasTres = [...container.querySelectorAll('text')].find(
      (t) => t.textContent?.trim() === 'LAS TRES',
    );
    // El escudo mide 120 de ancho en el lienzo; el original tiene el texto
    // cerca de 2,4 veces mas ancho. Si esta proporcion se pierde, el logo se
    // ve chico y perdido dentro del panel.
    expect(Number(lasTres?.getAttribute('textLength'))).toBeGreaterThan(120 * 2);
  });

  it('respeta el alto pedido y mantiene la proporción', () => {
    const { container } = render(<LogoLasTres alto={100} />);
    const svg = container.querySelector('svg')!;
    expect(Number(svg.getAttribute('height'))).toBe(100);
    // Levemente mas ancho que alto, como el isologo real.
    const ancho = Number(svg.getAttribute('width'));
    expect(ancho).toBeGreaterThan(100);
    expect(ancho).toBeLessThan(130);
  });
});

describe('StickerHerramientas', () => {
  it('es decorativo: no lo anuncian los lectores de pantalla', () => {
    const { container } = render(<StickerHerramientas />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('respeta el tamaño pedido', () => {
    const { container } = render(<StickerHerramientas tamano={48} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
  });
});
