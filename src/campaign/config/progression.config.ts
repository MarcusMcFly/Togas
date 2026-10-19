import type { UnlockRule } from '../../core/progression/UnlockManager';
import { POLLO_CHAPTER } from '../chapters/pollo/chapter.config';
import type { ChapterDefinition } from '../types';

/** Capítulos de la campaña, en orden. */
export const CHAPTERS: readonly ChapterDefinition[] = [POLLO_CHAPTER];

/**
 * Reglas de desbloqueo. Pollo está disponible desde el principio. Los demás personajes
 * se añadirán con su condición cuando existan, p. ej.:
 *   { characterId: '…', condition: { type: 'chapterCompleted', chapterId: 'pollo', minScore: … } }
 * La spec aún no fija ningún umbral, así que no se inventa ninguno.
 */
export const UNLOCK_RULES: readonly UnlockRule[] = [
  { characterId: 'pollo', condition: { type: 'initial' } },
];

export function getChapter(id: string): ChapterDefinition | null {
  return CHAPTERS.find((c) => c.id === id) ?? null;
}
