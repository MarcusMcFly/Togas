import type { CampaignAttempt } from '../../core/progression/CampaignSave';
import type { ChapterDefinition, MissionDefinition } from '../types';

/**
 * Estado de cada nodo del mapa del capítulo:
 * - `locked`: aún no se puede jugar (falta completar la anterior).
 * - `available`: es la siguiente y se puede empezar.
 * - `inProgress`: es la actual y está fallada o interrumpida (se puede reintentar).
 * - `completed`: superada en este intento.
 * - `notImplemented`: reservada, todavía sin implementar.
 */
export type NodeState = 'locked' | 'available' | 'inProgress' | 'completed' | 'notImplemented';

export interface MissionNode {
  mission: MissionDefinition;
  state: NodeState;
}

/**
 * La siguiente misión jugable en orden. Las misiones no se pueden saltar: si la primera
 * sin completar no es jugable, no hay siguiente.
 */
export function nextMission(chapter: ChapterDefinition, completed: readonly string[]): MissionDefinition | null {
  const done = new Set(completed);
  const next = chapter.missions.find((m) => !done.has(m.id));
  return next && next.status === 'playable' ? next : null;
}

export function isChapterComplete(chapter: ChapterDefinition, completed: readonly string[]): boolean {
  const done = new Set(completed);
  return chapter.missions.every((m) => done.has(m.id));
}

/** Si una puntuación final de capítulo llega para desbloquear al siguiente personaje. */
export interface NextCharacterStatus {
  required: number;
  score: number;
  reached: boolean;
}

export function nextCharacterStatus(chapter: ChapterDefinition, score: number): NextCharacterStatus | null {
  const required = chapter.nextCharacterScore;
  if (required === undefined) return null;
  return { required, score, reached: score >= required };
}

/** Texto para el jugador: qué ha conseguido (o cuánto le falta) para el siguiente personaje. */
export function describeNextCharacter(status: NextCharacterStatus, unlockedNames: readonly string[] = []): string {
  const points = (n: number) => n.toLocaleString('es-ES');
  if (unlockedNames.length) return `🔓 ¡Nuevo personaje desbloqueado: ${unlockedNames.join(', ')}!`;
  if (status.reached) return `🔓 ¡Superas los ${points(status.required)} puntos! El siguiente personaje queda desbloqueado para cuando llegue su capítulo.`;
  return `🔒 Para desbloquear al siguiente personaje hay que terminar el capítulo con ${points(status.required)} puntos. Te han faltado ${points(status.required - status.score)}.`;
}

/** Hay alguna misión reservada sin implementar: el capítulo está "En desarrollo". */
export function isChapterInDevelopment(chapter: ChapterDefinition): boolean {
  return chapter.missions.some((m) => m.status === 'planned');
}

export function chapterNodes(chapter: ChapterDefinition, attempt: CampaignAttempt | null): MissionNode[] {
  const done = new Set(attempt?.completedMissionIds ?? []);
  const current = attempt ? attempt.currentMissionId : nextMission(chapter, [])?.id ?? null;
  return chapter.missions.map((mission) => {
    let state: NodeState = 'locked';
    if (done.has(mission.id)) state = 'completed';
    else if (mission.status === 'planned') state = 'notImplemented';
    else if (mission.id === current) state = !attempt || attempt.status === 'ready' ? 'available' : 'inProgress';
    return { mission, state };
  });
}
