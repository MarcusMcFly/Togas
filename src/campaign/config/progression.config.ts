import type { UnlockRule } from '../../core/progression/UnlockManager';
import { POLLO_CHAPTER } from '../chapters/pollo/chapter.config';
import type { ChapterDefinition } from '../types';

/** Capítulos de la campaña, en orden. */
export const CHAPTERS: readonly ChapterDefinition[] = [POLLO_CHAPTER];

/**
 * Reglas de desbloqueo. Pollo está disponible desde el principio. El siguiente personaje
 * se desbloquea terminando el capítulo de Pollo con `POLLO_CHAPTER.nextCharacterScore`
 * puntos (1-3 decide la puntuación final). Cuando ese personaje exista, su regla será:
 *   { characterId: '…', condition: { type: 'chapterCompleted', chapterId: 'pollo', minScore: POLLO_CHAPTER.nextCharacterScore } }
 * Las mejores puntuaciones ya quedan guardadas, así que se desbloqueará con lo ya jugado.
 */
export const UNLOCK_RULES: readonly UnlockRule[] = [
  { characterId: 'pollo', condition: { type: 'initial' } },
];

export function getChapter(id: string): ChapterDefinition | null {
  return CHAPTERS.find((c) => c.id === id) ?? null;
}
