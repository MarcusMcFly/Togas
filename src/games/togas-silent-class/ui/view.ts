import type { Expression } from '../art/seatedPlayer';
import type { AttentionLevel } from '../config/professor.config';
import type { JoystickView } from '../input/BalanceTouchController';
import type { BalanceZone } from '../systems/BalanceSystem';

/** Todo lo que el HUD lee en cada fotograma. Lo rellena ClassroomScene. */
export interface ClassroomView {
  mode: 'play' | 'tutorial';
  skinId: string;
  expression: Expression;
  score: number;
  timeLeft: number;
  streak: number;
  multiplier: number;
  asleep: number;
  totalStudents: number;
  strikesLeft: number;
  maxStrikes: number;
  pressure: number;
  horizontal: number;
  vertical: number;
  zoneH: BalanceZone;
  zoneV: BalanceZone;
  holding: boolean;
  centered: boolean;
  /** 0–1 hacia los 350 ms de confirmación. */
  stability: number;
  attention: AttentionLevel;
  attentionProgress: number;
  /** Aviso reforzado (perk "Apuntes del Profe"). */
  attentionEmphasis: boolean;
  silence: boolean;
  joystick: JoystickView;
  highContrast: boolean;
  /** Los indicadores aún no se muestran (intro del tutorial). */
  showLevels: boolean;
}
