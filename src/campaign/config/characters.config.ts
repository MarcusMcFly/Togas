import type { CharacterDefinition } from '../../core/characters/CharacterDefinition';
import { POLLO } from '../characters/pollo/pollo.config';
import type { RosterSlot } from '../types';

/** Personajes de campaña con identidad aprobada. De momento, solo Pollo. */
export const CAMPAIGN_CHARACTERS: readonly CharacterDefinition[] = [POLLO];

/**
 * Los ocho huecos del plantel. Solo el primero tiene personaje: los otros siete no
 * tienen nombre, arte ni misión hasta que se aprueben (spec 1.1).
 */
export const ROSTER: readonly RosterSlot[] = [
  { slot: 1, characterId: POLLO.id },
  { slot: 2, characterId: null },
  { slot: 3, characterId: null },
  { slot: 4, characterId: null },
  { slot: 5, characterId: null },
  { slot: 6, characterId: null },
  { slot: 7, characterId: null },
  { slot: 8, characterId: null },
];

export function getCampaignCharacter(id: string | null): CharacterDefinition | null {
  return CAMPAIGN_CHARACTERS.find((c) => c.id === id) ?? null;
}
