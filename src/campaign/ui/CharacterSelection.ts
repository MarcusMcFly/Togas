import type { CharacterDefinition } from '../../core/characters/CharacterDefinition';
import { getSkin } from '../../core/characters/CharacterRegistry';
import { createButton } from '../../core/ui/Button';
import { h } from '../../core/ui/dom';
import type { SlotView } from '../systems/CampaignUnlockSystem';
import { portrait, silhouette } from './art';

export interface RosterOptions {
  slots: readonly SlotView[];
  onPick: (characterId: string) => void;
  onIntro: () => void;
  onExit: () => void;
}

/**
 * Los ocho huecos del plantel (spec 9.2). Los bloqueados solo muestran una silueta
 * genérica: ni nombre, ni arte, ni habilidad, ni misión.
 */
export function createRoster(options: RosterOptions): HTMLElement {
  const grid = h('ol', { className: 'roster', attrs: { 'aria-label': 'Héroes de la campaña' } },
    options.slots.map((slot, i) => {
      const character = slot.unlocked ? slot.character : null;
      if (!character) {
        return h('li', { className: 'roster__slot roster__slot--locked' }, [
          h('img', { className: 'roster__img', attrs: { src: silhouette(i), alt: '', draggable: 'false' } }),
          h('span', { className: 'roster__name', text: `Héroe ${slot.slot}` }),
          h('span', { className: 'roster__state', text: '🔒 Bloqueado' }),
        ]);
      }
      const button = h('button', {
        className: 'roster__slot roster__slot--open',
        attrs: { type: 'button', 'aria-label': `${character.name}: ${character.title}` },
      }, [
        h('img', { className: 'roster__img', attrs: { src: portrait(character.skinId), alt: '', draggable: 'false' } }),
        h('span', { className: 'roster__name', text: character.name }),
        h('span', { className: 'roster__state', text: character.specialTrait }),
      ]);
      button.addEventListener('click', () => options.onPick(character.id));
      return h('li', {}, [button]);
    }));

  return h('section', { className: 'camp-screen camp-panel' }, [
    h('header', { className: 'camp-header' }, [
      createButton({ label: 'Hub', icon: '←', variant: 'ghost', onClick: options.onExit }),
      createButton({ label: 'Ver intro', icon: '🎬', variant: 'ghost', onClick: options.onIntro }),
    ]),
    h('h1', { className: 'camp-title', text: 'Elige a tu héroe' }),
    h('p', { className: 'camp-subtitle', text: 'Ocho héroes. Ocho talentos cuestionables. De momento, solo uno ha aceptado la misión.' }),
    grid,
  ]);
}

export interface ProfileOptions {
  character: CharacterDefinition;
  completed: number;
  total: number;
  onContinue: () => void;
  onBack: () => void;
}

/** Ficha del personaje antes del capítulo (spec 9.3). */
export function createProfile(options: ProfileOptions): HTMLElement {
  const { character } = options;
  const skin = getSkin(character.skinId);
  return h('section', { className: 'camp-screen camp-panel' }, [
    h('header', { className: 'camp-header' }, [
      createButton({ label: 'Héroes', icon: '←', variant: 'ghost', onClick: options.onBack }),
    ]),
    h('article', { className: 'profile' }, [
      h('div', { className: 'profile__art' }, [
        h('img', { attrs: { src: portrait(character.skinId, 'collect'), alt: `${character.name}`, draggable: 'false' } }),
      ]),
      h('div', { className: 'profile__body' }, [
        h('h1', { className: 'profile__name', text: character.name.toUpperCase() }),
        h('p', { className: 'profile__title', text: character.title }),
        h('p', { className: 'profile__archetype', text: `${character.archetype} · ${skin.tagline}` }),
        ...character.bio.map((paragraph) => h('p', { className: 'profile__bio', text: paragraph })),
        h('dl', { className: 'profile__facts' }, [
          h('dt', { text: 'Habilidad especial' }), h('dd', { text: character.specialTrait }),
          h('dt', { text: 'Comida favorita (y peligrosa)' }), h('dd', { text: character.favoriteFood }),
          h('dt', { text: 'Progreso del capítulo' }), h('dd', { text: `${options.completed} / ${options.total} niveles completados` }),
        ]),
        h('ul', { className: 'profile__tags', attrs: { 'aria-label': 'Personalidad' } },
          character.personality.map((trait) => h('li', { className: 'chip', text: trait }))),
        createButton({ label: 'Ir al capítulo', icon: '▶', onClick: options.onContinue, className: 'profile__cta' }),
      ]),
    ]),
  ]);
}
