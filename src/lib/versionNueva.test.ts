import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recargarSiHayVersionNueva } from './versionNueva';

/**
 * Si después de publicar falta una parte del sistema que se baja al usarla
 * (el PDF), la página se recarga una vez; si vuelve a faltar enseguida, no
 * recarga sin fin y deja ver el error.
 */
describe('recargarSiHayVersionNueva', () => {
  const recargar = vi.fn();
  const original = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    recargar.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload: recargar },
    });
    recargarSiHayVersionNueva();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  const fallaUnaParte = () => {
    const evento = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(evento);
    return evento;
  };

  it('la primera vez recarga y no deja pasar el error', () => {
    const evento = fallaUnaParte();
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('REGRESION: si vuelve a fallar enseguida, no recarga de nuevo y el error se ve', () => {
    fallaUnaParte();
    recargar.mockClear();
    const segundo = fallaUnaParte();
    expect(recargar).not.toHaveBeenCalled();
    expect(segundo.defaultPrevented).toBe(false);
  });
});
