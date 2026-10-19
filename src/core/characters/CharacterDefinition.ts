/**
 * Personaje de campaña: identidad narrativa (nombre, biografía, rasgo, comida).
 *
 * Es un concepto distinto de la skin: la skin (CharacterRegistry) solo dice cómo se
 * dibuja y cómo suena; el personaje dice quién es en la historia. Un personaje se
 * dibuja con la skin `skinId`.
 */
export interface CharacterDefinition {
  /** Identificador estable (kebab-case). */
  id: string;
  /** Skin del registro compartido con la que se representa. */
  skinId: string;
  name: string;
  /** Apodo bajo el nombre ("El hombre que no puede estarse quieto"). */
  title: string;
  archetype: string;
  /** Biografía corta, un párrafo por elemento. */
  bio: readonly string[];
  personality: readonly string[];
  specialTrait: string;
  favoriteFood: string;
  /** Capítulo de campaña que protagoniza. */
  chapterId: string;
}
