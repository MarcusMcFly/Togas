import type { CharacterDefinition } from '../../../core/characters/CharacterDefinition';

/**
 * Pollo: primer personaje de la campaña. Se dibuja y suena con la skin `pollo` del
 * registro compartido, pero su identidad narrativa vive aquí.
 */
export const POLLO: CharacterDefinition = {
  id: 'pollo',
  skinId: 'pollo',
  name: 'Pollo',
  title: 'El hombre que no puede estarse quieto',
  archetype: 'Estudiante de ingeniería normal y corriente de una universidad pública',
  bio: [
    'Pollo es el compañero de viaje perfecto en el transporte público: nunca te disputará un asiento, porque sus piernas no dejan de moverse.',
    'En una LAN party es el que trae snacks y bebidas entre partida y partida. ¿Por qué? Porque, sencillamente, no puede estarse quieto.',
    'Y si le llamas al móvil, no esperes que conteste. Seguramente estará demasiado ocupado moviéndose.',
  ],
  personality: ['Inquieto', 'Enérgico', 'Se distrae con facilidad', 'Móvil por naturaleza', 'Ajeno a lo que provocan cantidades industriales de lentejas'],
  specialTrait: 'Piernas inquietas',
  favoriteFood: 'Lentejas',
  chapterId: 'pollo',
};
