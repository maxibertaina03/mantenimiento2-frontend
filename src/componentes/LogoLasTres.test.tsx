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

  it('incluye las tres estrellas del escudo', () => {
    const { container } = render(<LogoLasTres />);
    expect(container.querySelectorAll('use')).toHaveLength(3);
  });

  it('respeta el alto pedido y mantiene la proporción', () => {
    const { container } = render(<LogoLasTres alto={100} />);
    const svg = container.querySelector('svg')!;
    expect(Number(svg.getAttribute('height'))).toBe(100);
    // Más angosto que alto, como el isologo real.
    expect(Number(svg.getAttribute('width'))).toBeLessThan(100);
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
