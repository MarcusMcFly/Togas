import { describe, expect, it } from 'vitest';
import { GasSystem } from '../../src/games/togas-walking-arround/systems/GasSystem';

describe('GasSystem', () => {
  it('suma gas sin emitir mientras no llega al máximo (AC-04)', () => {
    const gas = new GasSystem(100, 5);
    expect(gas.add(30)).toEqual([]);
    expect(gas.current).toBe(30);
  });

  it('emite al llegar a 100 y conserva el sobrante (AC-06)', () => {
    const gas = new GasSystem(100, 5);
    gas.add(90);
    const emissions = gas.add(25);
    expect(emissions).toEqual([{ index: 1, tier: 1 }]);
    expect(gas.current).toBe(15);
  });

  it('emite exactamente en 100', () => {
    const gas = new GasSystem(100, 5);
    expect(gas.add(100)).toHaveLength(1);
    expect(gas.current).toBe(0);
  });

  it('nunca baja de cero (AC-05)', () => {
    const gas = new GasSystem(100, 5);
    gas.add(10);
    gas.reduce(35);
    expect(gas.current).toBe(0);
  });

  it('la intensidad sube con cada emisión y se detiene en el nivel 5 (AC-07)', () => {
    const gas = new GasSystem(100, 5);
    const tiers: number[] = [];
    for (let i = 0; i < 8; i++) tiers.push(...gas.add(100).map((e) => e.tier));
    expect(tiers).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
  });

  it('los antigases no bajan el nivel alcanzado (AC-07)', () => {
    const gas = new GasSystem(100, 5);
    gas.add(100);
    gas.add(100);
    gas.add(50);
    gas.reduce(35);
    gas.reduce(35);
    expect(gas.intensityTier).toBe(2);
  });

  it('reset deja todo a cero', () => {
    const gas = new GasSystem(100, 5);
    gas.add(250);
    gas.reset();
    expect([gas.current, gas.emissionCount, gas.intensityTier]).toEqual([0, 0, 0]);
  });
});
