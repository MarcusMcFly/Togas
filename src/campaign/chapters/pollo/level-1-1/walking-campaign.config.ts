import { COLLECTIBLES, LENTILS } from '../../../../games/togas-walking-arround/config/collectibles.config';
import { SPAWN_CONFIG } from '../../../../games/togas-walking-arround/config/spawn.config';
import type { WalkingRuleset } from '../../../../games/togas-walking-arround/mission';
import type { SpawnConfig } from '../../../../games/togas-walking-arround/systems/SpawnSystem';

/**
 * Patrones del recorrido de 1-1: los de la partida normal más vallas que saltar y
 * andamios/carteles bajo los que rodar. El SpawnSystem garantiza la separación mínima
 * entre obstáculos, así que siempre hay tiempo para distinguir saltar de rodar.
 */
export const COMMUTE_SPAWN: SpawnConfig = {
  ...SPAWN_CONFIG,
  patterns: [
    ...SPAWN_CONFIG.patterns,
    { id: 'jump-barrier', weight: 2.2, minProgress: 0.04, slots: [{ kind: 'barrier', dx: 0, action: 'jump' }] },
    {
      id: 'jump-barrier-reward',
      weight: 1.4,
      minProgress: 0.12,
      slots: [
        { kind: 'barrier', dx: 0, action: 'jump' },
        { kind: 'collectible', dx: 0, lane: 'mid' },
      ],
    },
    { id: 'roll-barrier', weight: 2, minProgress: 0.08, slots: [{ kind: 'barrier', dx: 0, action: 'roll' }] },
    {
      id: 'roll-barrier-reward',
      weight: 1.2,
      minProgress: 0.2,
      slots: [
        { kind: 'barrier', dx: 0, action: 'roll' },
        { kind: 'collectible', dx: 0, lane: 'ground' },
      ],
    },
  ],
};

/** Reglamento de "El trayecto de las lentejas" (spec 6). Todos los números son ajustables. */
export const LENTIL_COMMUTE_RULESET: WalkingRuleset = {
  id: 'pollo-1-1',
  // Las lentejas aparecen a menudo (identidad de Pollo) sin desplazar al resto de comida.
  collectibles: [{ ...LENTILS, spawnWeight: 1.6 }, ...COLLECTIBLES],
  itemMultipliers: { lentils: 3 },
  emissions: 'fartOnly',
  goal: { kind: 'distance', distance: 21000 },
  controls: 'tapAndSwipe',
  spawn: COMMUTE_SPAWN,
  traversal: ['work_fence', 'planter', 'scaffold', 'hanging_sign'],
  street: {
    emissionRadius: 170,
    multiplier: { start: 1, step: 0.25, max: 3 },
    speedBoost: { perEmission: 45, decayPerSec: 9, maxSpeed: 470 },
    maxWanted: 5,
  },
  pedestriansBothWays: true,
};
