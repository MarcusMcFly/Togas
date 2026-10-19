import { createButton } from '../../core/ui/Button';
import { h } from '../../core/ui/dom';
import { OPENING_NARRATION } from '../config/campaign.config';
import type { SlotView } from '../systems/CampaignUnlockSystem';
import { portrait, silhouette } from './art';

export interface IntroOptions {
  roster: readonly SlotView[];
  /** Se llama al terminar o al saltar la intro. */
  onFinish: () => void;
}

export interface Screen {
  element: HTMLElement;
  destroy(): void;
}

/**
 * Presentación de la campaña (spec 2.3): el universo, la leyenda de los ocho héroes,
 * la revelación de que sus talentos son vergonzosamente normales y las ocho siluetas
 * con Pollo destacado. Se avanza tocando y se puede saltar en cualquier momento.
 */
export function createIntro(options: IntroOptions): Screen {
  let index = 0;
  const text = h('p', { className: 'camp-intro__text' });
  const rosterRow = h('div', { className: 'camp-intro__roster', attrs: { 'aria-hidden': 'true' } },
    options.roster.map((slot, i) => {
      const unlocked = slot.unlocked && slot.character;
      return h('div', { className: unlocked ? 'camp-intro__hero camp-intro__hero--chosen' : 'camp-intro__hero' }, [
        h('img', { attrs: { src: unlocked && slot.character ? portrait(slot.character.skinId, 'strong') : silhouette(i), alt: '', draggable: 'false' } }),
      ]);
    }));
  const dots = h('div', { className: 'camp-intro__dots', attrs: { 'aria-hidden': 'true' } },
    OPENING_NARRATION.map(() => h('span', { className: 'camp-intro__dot' })));
  const next = createButton({ label: 'Siguiente', icon: '▸', onClick: () => advance() });
  const skip = createButton({ label: 'Saltar intro', variant: 'ghost', onClick: () => options.onFinish(), className: 'camp-intro__skip' });

  const stage = h('div', { className: 'camp-intro__stage', attrs: { 'aria-live': 'polite' } }, [text, rosterRow]);
  const element = h('section', { className: 'camp-screen camp-intro' }, [
    skip,
    stage,
    h('div', { className: 'camp-intro__footer' }, [dots, next]),
  ]);

  const render = () => {
    const beat = OPENING_NARRATION[index];
    text.textContent = beat.text;
    text.className = beat.aside ? 'camp-intro__text camp-intro__text--aside' : 'camp-intro__text';
    // Reinicia la animación de entrada en cada pantalla.
    text.classList.remove('camp-fade');
    void text.offsetWidth;
    text.classList.add('camp-fade');
    rosterRow.hidden = !beat.roster;
    [...dots.children].forEach((dot, i) => dot.classList.toggle('camp-intro__dot--on', i <= index));
    const last = index === OPENING_NARRATION.length - 1;
    const label = next.querySelector('span:last-child');
    if (label) label.textContent = last ? 'Conocer a los héroes' : 'Siguiente';
  };
  const advance = () => {
    if (index >= OPENING_NARRATION.length - 1) {
      options.onFinish();
      return;
    }
    index++;
    render();
  };
  stage.addEventListener('click', advance);
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Enter' || e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
      advance();
    }
  };
  window.addEventListener('keydown', onKey);
  render();

  return {
    element,
    destroy: () => {
      window.removeEventListener('keydown', onKey);
      element.remove();
    },
  };
}
