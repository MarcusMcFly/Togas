import type { GameContext } from '../../core/contracts/GameContext';
import type { GameSession } from '../../core/contracts/GameSession';
import type { MissionHost } from '../../core/contracts/Mission';
import type { WalkingRuleset } from './config/ruleset';
import type { WalkingMissionStats } from './runtime';
import { TogasSession } from './TogasSession';

export type { StreetRules, WalkingRuleset } from './config/ruleset';
export type { WalkingMissionStats } from './runtime';

/**
 * Walking Around jugado como misión de otro modo (la campaña): mismo motor, otro
 * reglamento. Sin selección de personaje ni pantalla de resultados propia: al terminar
 * avisa al anfitrión y es él quien decide qué viene después.
 */
export function createWalkingMission(
  context: GameContext,
  host: MissionHost<WalkingMissionStats>,
  ruleset: WalkingRuleset,
): GameSession {
  return new TogasSession(context, { host, ruleset });
}
