import { describe, expect, it } from 'vitest';
import { CAMPUS_RUN_RULES, campusCredits, parseTransfer } from '../../src/core/progression/CreditTransfer';
import { CampusRunManager } from '../../src/core/services/CampusRunManager';
import { MemoryStore } from '../../src/core/services/SaveManager';

const SEQUENCE = ['togas-walking-arround', 'togas-silent-class'];

function setup(start = 1_000_000) {
  let now = start;
  const store = new MemoryStore();
  const manager = new CampusRunManager({ sequence: SEQUENCE, store, now: () => now });
  return { manager, store, advance: (ms: number) => (now += ms) };
}

describe('Créditos de Campus', () => {
  it('1 crédito cada 250 puntos, máximo 12', () => {
    expect(campusCredits(500)).toBe(2);
    expect(campusCredits(1250)).toBe(5);
    expect(campusCredits(2500)).toBe(10);
    expect(campusCredits(3000)).toBe(12);
    expect(campusCredits(99_999)).toBe(12);
    expect(campusCredits(249)).toBe(0);
    expect(campusCredits(-5)).toBe(0);
  });

  it('rechaza transferencias manipuladas o corruptas', () => {
    const valid = {
      sourceGameId: 'togas-walking-arround', destinationGameId: 'togas-silent-class',
      sourceScore: 1000, credits: 4, skinId: 'pollo', createdAt: 1, consumed: false,
    };
    expect(parseTransfer(valid)).toEqual(valid);
    expect(parseTransfer({ ...valid, credits: 12 })).toBeNull();
    expect(parseTransfer({ ...valid, sourceScore: -1 })).toBeNull();
    expect(parseTransfer({ ...valid, skinId: '<script>' })).toBeNull();
    expect(parseTransfer('basura')).toBeNull();
    expect(parseTransfer(null)).toBeNull();
  });
});

describe('CampusRunManager', () => {
  it('conoce el orden de la carrera', () => {
    const { manager } = setup();
    expect(manager.nextGameAfter('togas-walking-arround')).toBe('togas-silent-class');
    expect(manager.nextGameAfter('togas-silent-class')).toBeNull();
    expect(manager.nextGameAfter('otro')).toBeNull();
  });

  it('una transferencia se usa exactamente una vez (GAME-009)', () => {
    const { manager } = setup();
    manager.offerTransfer({ sourceGameId: 'togas-walking-arround', sourceScore: 2750, skinId: 'marcus' });
    const peek = manager.peekTransfer('togas-silent-class');
    expect(peek).toMatchObject({ credits: 11, skinId: 'marcus', consumed: false });
    expect(manager.consumeTransfer('togas-silent-class')).toMatchObject({ credits: 11, consumed: true });
    expect(manager.consumeTransfer('togas-silent-class')).toBeNull();
    expect(manager.peekTransfer('togas-silent-class')).toBeNull();
  });

  it('caduca a los 10 minutos', () => {
    const { manager, advance } = setup();
    manager.offerTransfer({ sourceGameId: 'togas-walking-arround', sourceScore: 1000, skinId: 'pollo' });
    advance(CAMPUS_RUN_RULES.transferTtlMs + 1);
    expect(manager.consumeTransfer('togas-silent-class')).toBeNull();
  });

  it('solo vale para el juego de destino', () => {
    const { manager } = setup();
    manager.offerTransfer({ sourceGameId: 'togas-walking-arround', sourceScore: 1000, skinId: 'pollo' });
    expect(manager.peekTransfer('togas-walking-arround')).toBeNull();
    expect(manager.offerTransfer({ sourceGameId: 'togas-silent-class', sourceScore: 1000, skinId: 'pollo' })).toBeNull();
  });

  it('sobrevive a una recarga (mismo almacén, nuevo gestor)', () => {
    const { manager, store } = setup();
    manager.offerTransfer({ sourceGameId: 'togas-walking-arround', sourceScore: 750, skinId: 'pollo' });
    const reloaded = new CampusRunManager({ sequence: SEQUENCE, store, now: () => 1_000_500 });
    expect(reloaded.consumeTransfer('togas-silent-class')?.credits).toBe(3);
  });
});
