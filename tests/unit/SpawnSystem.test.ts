import { describe, expect, it } from 'vitest';
import { Random } from '../../src/core/utils/Random';
import {
  COLLECTIBLES, COLLECTIBLE_HITBOX, OBSTACLES, OBSTACLE_HITBOX,
} from '../../src/games/togas-walking-arround/config/collectibles.config';
import { GAME_CONFIG } from '../../src/games/togas-walking-arround/config/game.config';
import { SPAWN_CONFIG } from '../../src/games/togas-walking-arround/config/spawn.config';
import { overlaps, setRect, type Rect } from '../../src/games/togas-walking-arround/systems/CollisionSystem';
import { RunnerSystem, airTime, jumpApex, minObstacleGap } from '../../src/games/togas-walking-arround/systems/RunnerSystem';
import { SpawnSystem, type SpawnRequest } from '../../src/games/togas-walking-arround/systems/SpawnSystem';

const runner = GAME_CONFIG.runner;
const hitbox = GAME_CONFIG.playerHitbox;
const GAP = minObstacleGap(runner, hitbox.width, OBSTACLE_HITBOX.width, SPAWN_CONFIG.obstacleMargin);
/** Distancia que recorre una partida completa a velocidad máxima (el peor caso). */
const SESSION_DISTANCE = runner.maxSpeed * GAME_CONFIG.session.durationSec;

function generate(seed: number): SpawnRequest[] {
  const spawner = new SpawnSystem(SPAWN_CONFIG, COLLECTIBLES, OBSTACLES, new Random(seed), GAP);
  const out: SpawnRequest[] = [];
  // Simula el avance por tramos, con la dificultad creciendo como en una partida real.
  for (let d = 0; d <= SESSION_DISTANCE; d += 200) spawner.update(d + 1000, d / SESSION_DISTANCE, out);
  return out;
}

describe('SpawnSystem', () => {
  it('es determinista con la misma semilla', () => {
    expect(generate(1234)).toEqual(generate(1234));
    expect(generate(1234)).not.toEqual(generate(4321));
  });

  it('ningún patrón trae dos obstáculos más juntos de lo permitido', () => {
    for (const pattern of SPAWN_CONFIG.patterns) {
      const xs = pattern.slots.filter((s) => s.kind === 'obstacle').map((s) => s.dx).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(GAP);
    }
  });

  it('toda la comida en el aire está al alcance de un salto completo', () => {
    const reach = jumpApex(runner) + hitbox.height;
    for (const height of Object.values(SPAWN_CONFIG.lanes)) {
      expect(height - COLLECTIBLE_HITBOX.height / 2).toBeLessThan(reach);
    }
  });

  it('separa siempre los obstáculos al menos la distancia mínima (AC-14)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const xs = generate(seed).filter((r) => r.kind === 'obstacle').map((r) => r.x);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(GAP - 1e-6);
    }
  });

  /**
   * Prueba fuerte de AC-14: un jugador automático recorre partidas enteras a velocidad
   * máxima. Salta (manteniendo) cuando el siguiente obstáculo está a media parábola.
   * Si alguna secuencia fuese imposible, chocaría.
   */
  it('un bot puede esquivar todos los obstáculos a velocidad máxima (AC-14)', () => {
    const dt = 1 / 120;
    const anchorX = 0;
    const triggerDistance = (runner.maxSpeed * airTime(runner)) / 2;
    const player: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const box: Rect = { x: 0, y: 0, w: 0, h: 0 };

    for (let seed = 1; seed <= 40; seed++) {
      const obstacles = generate(seed).filter((r) => r.kind === 'obstacle').map((r) => r.x);
      expect(obstacles.length).toBeGreaterThan(20);
      const sim = new RunnerSystem(runner);
      let next = 0;
      let hits = 0;
      while (sim.distance < SESSION_DISTANCE && next < obstacles.length) {
        const px = sim.distance + anchorX;
        // Obstáculo ya superado del todo: pasar al siguiente.
        if (obstacles[next] + (OBSTACLE_HITBOX.width + hitbox.width) / 2 < px) {
          next++;
          continue;
        }
        if (sim.grounded && obstacles[next] - px <= triggerDistance) sim.pressJump();
        sim.update(dt, 1);
        if (sim.justLanded) sim.releaseJump();

        setRect(player, sim.distance + anchorX, sim.height, hitbox.width, hitbox.height);
        setRect(box, obstacles[next], 0, OBSTACLE_HITBOX.width, OBSTACLE_HITBOX.height);
        if (overlaps(player, box)) {
          hits++;
          next++;
        }
      }
      expect(hits, `semilla ${seed}`).toBe(0);
    }
  });
});
