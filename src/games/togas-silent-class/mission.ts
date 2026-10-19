import type { GameContext } from '../../core/contracts/GameContext';
import type { GameSession } from '../../core/contracts/GameSession';
import type { ClassroomMission } from './runtime';
import { SilentClassSession } from './SilentClassSession';

export type { ChairRules, ClassroomRules } from './config/ruleset';
export type { ClassroomMission, ClassroomMissionStats, ClassroomMissionTexts, ClassroomPenalties } from './runtime';

/**
 * Silent Class jugado como misión de otro modo (la campaña): misma clase, otro
 * reglamento. Sin pantalla previa, tutorial ni resultados propios: al terminar avisa
 * al anfitrión y es él quien decide qué viene después.
 */
export function createClassroomMission(context: GameContext, mission: ClassroomMission): GameSession {
  return new SilentClassSession(context, mission);
}
