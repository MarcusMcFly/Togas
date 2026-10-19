/**
 * Reglas de desbloqueo de personajes, expresadas como datos. La interfaz nunca
 * decide quién está desbloqueado: pregunta aquí.
 */

/** Condición para desbloquear un personaje. Se pueden añadir tipos sin tocar la UI. */
export type UnlockCondition =
  | { type: 'initial' }
  | { type: 'chapterCompleted'; chapterId: string; minScore?: number }
  | { type: 'allOf'; conditions: readonly UnlockCondition[] };

export interface UnlockRule {
  characterId: string;
  condition: UnlockCondition;
}

/** Lo que el jugador ha conseguido hasta ahora. */
export interface ProgressSnapshot {
  /** Mejor puntuación final de cada capítulo completado. */
  completedChapters: Readonly<Record<string, number>>;
}

export function isConditionMet(condition: UnlockCondition, progress: ProgressSnapshot): boolean {
  switch (condition.type) {
    case 'initial':
      return true;
    case 'chapterCompleted': {
      const score = progress.completedChapters[condition.chapterId];
      return score !== undefined && score >= (condition.minScore ?? 0);
    }
    case 'allOf':
      return condition.conditions.every((c) => isConditionMet(c, progress));
  }
}

export class UnlockManager {
  constructor(private readonly rules: readonly UnlockRule[]) {}

  /** Personajes desbloqueados desde el principio. */
  initial(): string[] {
    return this.rules.filter((r) => r.condition.type === 'initial').map((r) => r.characterId);
  }

  /** Todos los personajes cuya condición se cumple con este progreso. */
  evaluate(progress: ProgressSnapshot): string[] {
    return this.rules.filter((r) => isConditionMet(r.condition, progress)).map((r) => r.characterId);
  }

  /** Los que se desbloquean ahora y antes no lo estaban. */
  newlyUnlocked(progress: ProgressSnapshot, alreadyUnlocked: readonly string[]): string[] {
    const known = new Set(alreadyUnlocked);
    return this.evaluate(progress).filter((id) => !known.has(id));
  }
}
