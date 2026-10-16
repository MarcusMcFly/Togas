/**
 * Ventajas temporales que se compran con Créditos de Campus (solo al continuar desde
 * Walking Around). Una por sesión, iguales para todas las skins.
 */
export type PerkId = 'ironCheeks' | 'professorNotes' | 'soundproofChair';

export interface PerkDefinition {
  id: PerkId;
  name: string;
  cost: number;
  description: string;
}

export const PERKS: readonly PerkDefinition[] = [
  { id: 'ironCheeks', name: 'Glúteos de Acero', cost: 4, description: 'Menos deriva de las burbujas los primeros 20 s' },
  { id: 'professorNotes', name: 'Apuntes del Profe', cost: 5, description: 'Aviso más claro y largo antes de que se gire' },
  { id: 'soundproofChair', name: 'Silla Insonorizada', cost: 8, description: 'Anula el primer aviso por trompetazo (no la penalización)' },
];

export const PERK_EFFECTS = {
  ironCheeks: { driftFactor: 0.6, durationSec: 20 },
} as const;

export function getPerk(id: string | null | undefined): PerkDefinition | null {
  return PERKS.find((p) => p.id === id) ?? null;
}
