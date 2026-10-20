import type { WalkingRuleset } from '../../../../games/togas-walking-arround/mission';
import { LENTIL_COMMUTE_RULESET } from '../level-1-1/walking-campaign.config';

/**
 * Reglamento de "Vuelta a la base" (1-3): el mismo juego que 1-1, en la misma ciudad
 * pero de noche y recorrida al revés (de derecha a izquierda), de la universidad a casa.
 * Todos los números son ajustables.
 *
 * - Mismas penalizaciones que 1-1, salvo la policía: un pedo con testigos reinicia el
 *   multiplicador y, en vez de una estrella, cuesta `witnessPenalty.points`.
 * - Esta misión no se puede perder: llegar a casa la completa aunque se quede en 0 puntos.
 */
export const RETURN_HOME_RULESET: WalkingRuleset = {
  ...LENTIL_COMMUTE_RULESET,
  id: 'pollo-1-3',
  goal: {
    kind: 'distance', distance: 21000, destination: 'home', origin: 'university',
    arrivalText: '¡DE VUELTA\nEN CASA!', requiresPoints: false,
  },
  direction: 'reverse',
  night: true,
  street: {
    ...LENTIL_COMMUTE_RULESET.street!,
    witnessPenalty: { kind: 'points', points: 300 },
  },
};
