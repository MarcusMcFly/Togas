import type { CharacterDefinition } from '../../core/characters/CharacterDefinition';
import { UnlockManager, type UnlockRule } from '../../core/progression/UnlockManager';
import type { RosterSlot } from '../types';

export interface SlotView {
  slot: number;
  /** `null` si el hueco aún no tiene personaje aprobado. */
  character: CharacterDefinition | null;
  unlocked: boolean;
}

/**
 * Une el plantel (huecos), los personajes y las reglas de desbloqueo. La interfaz solo
 * pinta lo que devuelve `roster()`: nunca decide quién está disponible.
 */
export class CampaignUnlockSystem {
  private readonly manager: UnlockManager;

  constructor(
    private readonly slots: readonly RosterSlot[],
    private readonly characters: readonly CharacterDefinition[],
    rules: readonly UnlockRule[],
  ) {
    this.manager = new UnlockManager(rules);
  }

  initial(): string[] {
    return this.manager.initial();
  }

  /** Personajes que se desbloquean con este progreso y antes no lo estaban. */
  newlyUnlocked(bestChapterScores: Readonly<Record<string, number>>, alreadyUnlocked: readonly string[]): string[] {
    return this.manager.newlyUnlocked({ completedChapters: bestChapterScores }, alreadyUnlocked);
  }

  roster(unlocked: readonly string[]): SlotView[] {
    const open = new Set(unlocked);
    return this.slots.map(({ slot, characterId }) => {
      const character = this.characters.find((c) => c.id === characterId) ?? null;
      return { slot, character, unlocked: character !== null && open.has(character.id) };
    });
  }
}
