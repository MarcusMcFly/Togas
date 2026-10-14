import { describe, expect, it } from 'vitest';
import { GameRegistry } from '../../src/app/GameRegistry';
import type { GameModule } from '../../src/core/contracts/GameModule';
import { templateGame } from '../../src/games/_template';

const fakeGame = (id: string): GameModule => ({
  id,
  title: id,
  version: '0.0.0',
  description: '',
  thumbnail: '',
  supportedInputs: ['keyboard'],
  preload: () => Promise.resolve(),
  create: () => ({ start() {}, pause() {}, resume() {}, destroy() {} }),
  destroy: () => undefined,
});

describe('GameRegistry', () => {
  it('registra un juego nuevo sin tocar los existentes (AC-12)', () => {
    const registry = new GameRegistry();
    registry.register(fakeGame('togas-walking-arround'));
    registry.register(templateGame);
    expect(registry.list().map((g) => g.id)).toEqual(['togas-walking-arround', 'plantilla']);
  });

  it('rechaza IDs duplicados', () => {
    const registry = new GameRegistry();
    registry.register(fakeGame('mi-juego'));
    expect(() => registry.register(fakeGame('mi-juego'))).toThrow(/Ya hay un juego/);
  });

  it('rechaza IDs que no son kebab-case', () => {
    expect(() => new GameRegistry().register(fakeGame('Mi Juego'))).toThrow(/kebab-case/);
  });

  it('la plantilla cumple el contrato', () => {
    expect(templateGame.supportedInputs.length).toBeGreaterThan(0);
    expect(typeof templateGame.create).toBe('function');
  });
});
