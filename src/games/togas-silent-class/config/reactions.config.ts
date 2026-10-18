/**
 * Reacciones de los compañeros (anexo 01, IMP-04). Todo es configurable: textos,
 * bonus, pesos de probabilidad y animaciones. Siempre cartoon y nada explícito.
 */

/** Animación que hace un compañero al recibir la nube (o el trompetazo). */
export type ReactionAnim = 'confused' | 'grimace' | 'gasHit' | 'recoil' | 'deepSleep' | 'startled';

export interface StudentReactionDef {
  id: string;
  /** Texto flotante estilo cómic sobre el compañero. */
  message: string;
  color: string;
  /** Puntos extra (una vez por compañero y emisión). Se suman a los de dormirlo. */
  bonus: number;
  /** Rango de intensidad local (0–1) en el que puede salir. */
  minIntensity: number;
  maxIntensity: number;
  /** Peso relativo frente a otras reacciones del mismo rango. */
  weight: number;
  anim: ReactionAnim;
}

export interface ClassReactionDef {
  id: string;
  message: string;
  color: string;
  bonus: number;
  /** Prioridad: se evalúan en orden y gana la primera que se cumple. */
  test: (c: ClassReactionContext) => boolean;
}

export interface ClassReactionContext {
  kind: 'silent' | 'trumpet';
  pressure: number;
  perfect: boolean;
  /** Compañeros alcanzados (nube) o asustados (trompetazo). */
  affected: number;
  /** Intensidad del trompetazo (1–5); 0 si fue silencioso. */
  trumpetIntensity: number;
}

export interface ReactionTuning {
  pressureExponent: number;
  distanceFalloff: number;
  asleepBoost: number;
  reactionSec: number;
  cloudSpeed: number;
  bonusWhenDetected: boolean;
  /** Máximo de textos flotantes por emisión (los más cercanos), para no tapar el aula. */
  maxMessages: number;
}

export const REACTION_CONFIG: Readonly<ReactionTuning> = {
  /**
   * Intensidad de la emisión (0–1) a partir de la presión al soltar: exponente > 1
   * reserva las reacciones fuertes para las presiones altas.
   */
  pressureExponent: 1.3,
  /** Cuánto se pierde de intensidad en el borde del alcance (0 = nada, 1 = todo). */
  distanceFalloff: 0.45,
  /** Los que caen dormidos reciben la nube de lleno: su intensidad se multiplica por esto. */
  asleepBoost: 1.15,
  /** Duración del estado de reacción de cada compañero (s). */
  reactionSec: 1.8,
  /** Velocidad visual de la nube hacia cada compañero (px lógicos/s). */
  cloudSpeed: 340,
  /** Con el profe mirando no hay bonus de reacción (la penalización ya llega aparte). */
  bonusWhenDetected: false,
  maxMessages: 4,
};

export const STUDENT_REACTIONS: readonly StudentReactionDef[] = [
  { id: 'suspiciousBreeze', message: 'Brisa sospechosa', color: '#d8f3a2', bonus: 0, minIntensity: 0, maxIntensity: 0.35, weight: 1, anim: 'confused' },
  { id: 'whatSmell', message: '¿Huele a…?', color: '#d8f3a2', bonus: 0, minIntensity: 0, maxIntensity: 0.3, weight: 0.6, anim: 'confused' },
  { id: 'nauseated', message: 'Vecino mareado', color: '#b5e36b', bonus: 10, minIntensity: 0.25, maxIntensity: 0.6, weight: 1, anim: 'grimace' },
  { id: 'nauseatingNeighbor', message: 'Vecino nauseabundo', color: '#b5e36b', bonus: 10, minIntensity: 0.25, maxIntensity: 0.6, weight: 1, anim: 'grimace' },
  { id: 'eyesWatering', message: '¡Le lloran los ojos!', color: '#b5e36b', bonus: 10, minIntensity: 0.3, maxIntensity: 0.65, weight: 0.7, anim: 'grimace' },
  { id: 'stench', message: '¡Hedor penetrante!', color: '#8bd450', bonus: 15, minIntensity: 0.5, maxIntensity: 0.85, weight: 1, anim: 'gasHit' },
  { id: 'jaodaPenetrante', message: '¡Jaoda penetrante!', color: '#8bd450', bonus: 15, minIntensity: 0.5, maxIntensity: 0.85, weight: 1, anim: 'gasHit' },
  { id: 'gasMask', message: '¡Que alguien abra!', color: '#8bd450', bonus: 15, minIntensity: 0.55, maxIntensity: 0.9, weight: 0.6, anim: 'gasHit' },
  { id: 'directHit', message: '¡Impacto directo!', color: '#ffd23f', bonus: 25, minIntensity: 0.75, maxIntensity: 1, weight: 1, anim: 'recoil' },
  { id: 'knockout', message: '¡K.O. aromático!', color: '#ffd23f', bonus: 25, minIntensity: 0.8, maxIntensity: 1, weight: 0.6, anim: 'recoil' },
];

/** Reacción al trompetazo de cada compañero que lo oye (sin bonus: es un fallo). */
export const TRUMPET_REACTIONS: readonly StudentReactionDef[] = [
  { id: 'jump', message: '¡¿Qué ha sido eso?!', color: '#ff8a3d', bonus: 0, minIntensity: 0, maxIntensity: 1, weight: 1, anim: 'startled' },
  { id: 'giggle', message: 'jajaja', color: '#ffd23f', bonus: 0, minIntensity: 0, maxIntensity: 1, weight: 0.8, anim: 'startled' },
  { id: 'point', message: '¡Ha sido él!', color: '#ff4d6d', bonus: 0, minIntensity: 0.5, maxIntensity: 1, weight: 0.6, anim: 'startled' },
];

/** Titular de la emisión completa. Solo sale uno, el primero que se cumpla. */
export const CLASS_REACTIONS: readonly ClassReactionDef[] = [
  { id: 'silentApocalypse', message: '¡APOCALIPSIS SILENCIOSO!', color: '#b06cff', bonus: 50, test: (c) => c.kind === 'silent' && c.perfect && c.pressure >= 80 },
  { id: 'contamination', message: '¡CONTAMINACIÓN EN EL AULA!', color: '#5ec46a', bonus: 30, test: (c) => c.kind === 'silent' && c.affected >= 3 },
  { id: 'trumpetDisaster', message: '¡DESASTRE DE TROMPETA!', color: '#ff4d6d', bonus: 0, test: (c) => c.kind === 'trumpet' && c.trumpetIntensity >= 3 },
];
