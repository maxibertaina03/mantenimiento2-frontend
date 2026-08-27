import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoLasTres, logoComoSvg } from './LogoLasTres';
import { StickerHerramientas } from './StickerHerramientas';
import {
  MARRON_LAS_TRES,
  PATHS_MARRON,
  PATHS_ROJO,
  ROJO_LAS_TRES,
} from './logoPaths';

/**
 * El logo es ahora el archivo oficial (src/assets/logo.svg), no una
 * reconstrucción. Como ese archivo es un trazado monocromo, lo que hay que
 * proteger es el coloreado: si los paths se reordenan o se recorta el archivo,
 * el logo saldría todo negro o con las partes mal pintadas.
 */
describe('LogoLasTres', () => {
  it('rinde el nombre de la empresa como texto accesible', () => {
    render(<LogoLasTres />);
    expect(screen.getByRole('img', { name: /Lácteos Las Tres/i })).toBeInTheDocument();
  });

  it('dibuja los 33 paths del archivo original', () => {
    const { container } = render(<LogoLasTres />);
    expect(container.querySelectorAll('path')).toHaveLength(33);
    expect(PATHS_ROJO.length + PATHS_MARRON.length).toBe(33);
  });

  it('REGRESION: ningun path queda en negro (el archivo viene monocromo)', () => {
    const { container } = render(<LogoLasTres />);
    const grupos = [...container.querySelectorAll('g[fill]')];
    expect(grupos.length).toBeGreaterThan(0);
    for (const g of grupos) {
      expect(g.getAttribute('fill')).not.toBe('#000000');
    }
  });

  it('REGRESION: el escudo y "LAS TRES" van en rojo institucional', () => {
    const { container } = render(<LogoLasTres />);
    const rojo = container.querySelector(`g[fill="${ROJO_LAS_TRES}"]`);
    expect(rojo).not.toBeNull();
    expect(rojo!.querySelectorAll('path')).toHaveLength(PATHS_ROJO.length);
  });

  it('REGRESION: "LACTEOS" y "EST. 1989" van en marron, no en rojo', () => {
    const { container } = render(<LogoLasTres />);
    const marron = container.querySelector(`g[fill="${MARRON_LAS_TRES}"]`);
    expect(marron).not.toBeNull();
    expect(marron!.querySelectorAll('path')).toHaveLength(PATHS_MARRON.length);
    expect(MARRON_LAS_TRES).not.toBe(ROJO_LAS_TRES);
  });

  it('conserva el transform del trazado (invierte el eje Y)', () => {
    const { container } = render(<LogoLasTres />);
    const grupo = container.querySelector('svg > g');
    expect(grupo?.getAttribute('transform')).toContain('scale(0.1,-0.1)');
  });

  it('es cuadrado y respeta el alto pedido', () => {
    const { container } = render(<LogoLasTres alto={120} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('height')).toBe('120');
    expect(svg.getAttribute('width')).toBe('120');
  });
});

describe('logoComoSvg (para el PDF)', () => {
  it('devuelve un SVG completo con el namespace', () => {
    const svg = logoComoSvg();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('lleva los dos colores del logo', () => {
    const svg = logoComoSvg();
    expect(svg).toContain(ROJO_LAS_TRES);
    expect(svg).toContain(MARRON_LAS_TRES);
  });

  it('incluye todos los paths', () => {
    const svg = logoComoSvg();
    expect(svg.match(/<path /g)).toHaveLength(33);
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
