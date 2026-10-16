import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/games/togas-walking-arround/config/game.config';
import { SKINS } from '../../src/core/characters/CharacterRegistry';
import { RunnerSystem, jumpApex } from '../../src/games/togas-walking-arround/systems/RunnerSystem';

const DT = 1 / 120;
const params = GAME_CONFIG.runner;

/** Simula un salto manteniendo pulsado `holdSec` segundos y devuelve la altura máxima. */
function peakHeight(holdSec: number): number {
  const runner = new RunnerSystem(params);
  runner.pressJump();
  let peak = 0;
  for (let t = 0; t < 2; t += DT) {
    if (t >= holdSec) runner.releaseJump();
    runner.update(DT, 0);
    peak = Math.max(peak, runner.height);
  }
  return peak;
}

describe('RunnerSystem', () => {
  it('avanza solo a la velocidad inicial y acelera hasta la máxima', () => {
    const runner = new RunnerSystem(params);
    runner.update(1, 0);
    expect(runner.distance).toBeCloseTo(params.startSpeed);
    runner.update(0.01, 1);
    expect(runner.speed).toBe(params.maxSpeed);
  });

  it('mantener pulsado salta más alto que un toque', () => {
    const tap = peakHeight(0);
    const hold = peakHeight(1);
    expect(hold).toBeGreaterThan(tap * 1.5);
    expect(hold).toBeCloseTo(jumpApex(params), -1);
    expect(tap).toBeCloseTo(jumpApex(params, params.minJumpVelocity), -1);
  });

  it('vuelve al suelo y avisa del aterrizaje', () => {
    const runner = new RunnerSystem(params);
    runner.pressJump();
    let landed = false;
    for (let t = 0; t < 2; t += DT) {
      runner.update(DT, 0);
      landed ||= runner.justLanded;
    }
    expect(landed).toBe(true);
    expect(runner.grounded).toBe(true);
    expect(runner.height).toBe(0);
  });

  it('recuerda una pulsación hecha justo antes de aterrizar', () => {
    const runner = new RunnerSystem(params);
    runner.pressJump();
    runner.releaseJump();
    let jumps = 0;
    for (let t = 0; t < 1.5; t += DT) {
      if (!runner.grounded && runner.velocityY < 0 && runner.height < 15 && jumps === 1) {
        runner.pressJump();
        runner.releaseJump();
      }
      runner.update(DT, 0);
      if (runner.justJumped) jumps++;
    }
    expect(jumps).toBe(2);
  });

  it('las skins no definen física propia: comparten caja y parámetros (AC-02)', () => {
    const physicsKeys = ['speed', 'gravity', 'jump', 'hitbox', 'collision'];
    for (const skin of SKINS) {
      for (const key of Object.keys(skin)) {
        expect(physicsKeys.some((p) => key.toLowerCase().includes(p))).toBe(false);
      }
    }
  });
});
