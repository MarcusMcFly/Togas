/**
 * Contrato entre un orquestador de misiones (el modo campaña) y un minijuego que
 * se juega como misión. El minijuego no sabe nada de capítulos ni desbloqueos:
 * recibe un contexto, informa de lo que pasa y avisa al terminar.
 */

export type GameMode = 'standalone' | 'campaign';

/** Datos con los que arranca una misión. */
export interface MissionContext {
  mode: 'campaign';
  campaignId: string;
  chapterId: string;
  missionId: string;
  /** Personaje de campaña (identidad narrativa). */
  characterId: string;
  /** Skin del registro compartido con la que se dibuja y suena el personaje. */
  skinId: string;
  /** Puntos de campaña con los que se entra en la misión. */
  startingScore: number;
  rulesetId: string;
}

/** Eventos que un minijuego comunica al orquestador durante una misión. */
export type CampaignEvent =
  | { type: 'MISSION_STARTED'; missionId: string }
  | { type: 'CAMPAIGN_POINTS_EARNED'; amount: number }
  | { type: 'CAMPAIGN_POINTS_LOST'; amount: number }
  | { type: 'POLICE_STAR_ADDED'; wantedLevel: number }
  | { type: 'STUDENT_AFFECTED'; studentId: string }
  | { type: 'CHAIR_FALL'; fallCount: number }
  | { type: 'ARISTOCRAT_DEFEATED' }
  | { type: 'MISSION_COMPLETED'; missionId: string }
  | { type: 'MISSION_FAILED'; missionId: string; reason: string };

/** Resultado de procesar un evento: la puntuación de campaña SIEMPRE la decide el orquestador. */
export interface ScoreChange {
  /** Puntos realmente aplicados (positivo = ganados, negativo = perdidos, 0 = rechazado o sin efecto). */
  applied: number;
  /** Puntuación de campaña tras el evento. */
  score: number;
  /** La puntuación acaba de llegar a cero: el intento de campaña está perdido. */
  depleted: boolean;
}

export interface MissionOutcome<Stats> {
  status: 'completed' | 'failed';
  /** Motivo del fallo (`arrested`, `caught`, `bankrupt`…). */
  reason?: string;
  stats: Stats;
}

/** Lo que el orquestador presta a un minijuego mientras se juega una misión. */
export interface MissionHost<Stats> {
  readonly context: MissionContext;
  /** Puntuación de campaña actual (la única válida). */
  readonly score: number;
  report(event: CampaignEvent): ScoreChange;
  /** La misión ha terminado. El orquestador decide qué se muestra después. */
  finish(outcome: MissionOutcome<Stats>): void;
}
