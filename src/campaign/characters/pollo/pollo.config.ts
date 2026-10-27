import type { CharacterDefinition } from '../../../core/characters/CharacterDefinition';

/**
 * Pollo: primer personaje de la campaña. Se dibuja y suena con la skin `pollo` del
 * registro compartido, pero su identidad narrativa vive aquí.
 */
export const POLLO: CharacterDefinition = {
  id: 'pollo',
  skinId: 'pollo',
  name: 'Pollo',
  title: 'Pereza y dopamina, a la vez y en todas partes',
  archetype: 'Estudiante de ingeniería normal y corriente de una universidad pública',
  bio: [
    'Es el mejor compañero para viajar en trasporte público ya que nunca irá sentado y te cederá el sitio, porque tiene las piernas inquietas. En tu LAN PARTY es el que traerá avituallamiento entre partidas porque tiene las piernas inquietas. Si le llamas al móvil no te lo cogerá',
  ],
  personality: ['Hechicero con dote de ballesta de repetición, porque lo vió en un dibujo'],
  specialTrait: 'Piernas inquietas',
  favoriteFood: 'Lentejas',
  chapterId: 'pollo',
};
