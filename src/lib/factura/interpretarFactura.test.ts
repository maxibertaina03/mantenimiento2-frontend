import { describe, expect, it } from 'vitest';
import {
  armarRenglones,
  detectarCuits,
  detectarLetra,
  interpretarFactura,
  interpretarRenglon,
  leerNumero,
  type Palabra,
} from './interpretarFactura';

// Renglones con la forma de facturas reales, con datos inventados.

describe('leerNumero', () => {
  it('lee los números como se escriben acá, y los de sistemas en inglés', () => {
    expect(leerNumero('1.234,56')).toBe(1234.56);
    expect(leerNumero('1234,5')).toBe(1234.5);
    expect(leerNumero('$12.100,00')).toBe(12100);
    expect(leerNumero('1.234')).toBe(1234);
    expect(leerNumero('1,234.56')).toBe(1234.56);
    expect(leerNumero('12.5')).toBe(12.5);
    expect(leerNumero('6204')).toBe(6204);
    expect(leerNumero('2RS')).toBeNull();
  });
});

describe('interpretarRenglon', () => {
  it('cantidad × precio = importe: el precio es seguro', () => {
    expect(
      interpretarRenglon('SK6204 ROD. 6204 2RS SKF 4,00 u 6.050,00 24.200,00', 0),
    ).toMatchObject({
      codigo: 'SK6204',
      descripcion: 'ROD. 6204 2RS SKF',
      cantidad: 4,
      precioUnitario: 6050,
      importe: 24200,
      cierra: true,
    });
  });

  it('con la cantidad al principio', () => {
    expect(interpretarRenglon('2 CORREA EN V A-40 12.100,00 24.200,00', 0)).toMatchObject({
      cantidad: 2,
      precioUnitario: 12100,
      cierra: true,
    });
  });

  it('con bonificación', () => {
    expect(interpretarRenglon('10 CINTA AISLADORA 19MM 500,00 10% 4.500,00', 0)).toMatchObject({
      cantidad: 10,
      precioUnitario: 500,
      bonificacion: 10,
      cierra: true,
    });
  });

  it('si los números no cierran, propone igual pero dudoso', () => {
    expect(interpretarRenglon('GRASA LITIO 1KG 3,00 8.000,00 25.000,00', 0)).toMatchObject({
      precioUnitario: 8000,
      cierra: false,
    });
  });

  it('los totales, el IVA y los datos de la factura no son ítems', () => {
    expect(interpretarRenglon('Subtotal 48.400,00', 0)).toBeNull();
    expect(interpretarRenglon('IVA 21% 10.164,00', 0)).toBeNull();
    expect(interpretarRenglon('Total $ 58.564,00', 0)).toBeNull();
    expect(interpretarRenglon('CUIT: 30-12345678-9 Fecha 01/11/2026', 0)).toBeNull();
  });
});

describe('la factura entera', () => {
  const p = (texto: string, x: number, y: number): Palabra => ({
    texto,
    x,
    y,
    alto: 10,
    pagina: 1,
  });

  it('arma los renglones por altura aunque las palabras vengan mezcladas', () => {
    const renglones = armarRenglones([
      p('6.050,00', 300, 101),
      p('ROD. 6204', 50, 100),
      p('4', 10, 99),
      p('24.200,00', 400, 100),
      p('Total', 10, 200),
    ]);
    expect(renglones.map((r) => r.map((w) => w.texto).join(' '))).toEqual([
      '4 ROD. 6204 6.050,00 24.200,00',
      'Total',
    ]);
  });

  it('saca la letra, el CUIT y los ítems', () => {
    const f = interpretarFactura([
      p('FACTURA', 200, 10),
      p('B', 260, 10),
      p('CUIT: 30-12345678-9', 10, 30),
      p('4 ROD. 6204 2RS 6.050,00 24.200,00', 10, 100),
      p('2 CORREA A-40 12.100,00 24.200,00', 10, 115),
      p('Total 48.400,00', 10, 200),
    ]);
    expect(f.letra).toBe('B');
    expect(f.cuits).toEqual(['30-12345678-9']);
    expect(f.items.map((i) => [i.indice, i.precioUnitario])).toEqual([
      [0, 6050],
      [1, 12100],
    ]);
  });
});

describe('detectar la letra', () => {
  it('por el código de comprobante', () => {
    expect(detectarLetra(['ORIGINAL', 'COD. 01'])).toBe('A');
    expect(detectarLetra(['Código N° 006'])).toBe('B');
    expect(detectarLetra(['COD. 11'])).toBe('C');
  });

  it('por la letra sola en su recuadro', () => {
    expect(detectarLetra(['EMPRESA SRL', 'A', 'ORIGINAL'])).toBe('A');
  });

  it('el CUIT con o sin guiones', () => {
    expect(detectarCuits(['CUIT 30123456789', 'CUIT: 20-11111111-2'])).toEqual([
      '30-12345678-9',
      '20-11111111-2',
    ]);
  });
});
