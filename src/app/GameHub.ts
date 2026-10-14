import type { GameModule, InputKind } from '../core/contracts/GameModule';
import type { SettingsManager } from '../core/services/SettingsManager';
import { createButton } from '../core/ui/Button';
import { h } from '../core/ui/dom';
import { Overlay } from '../core/ui/Overlay';
import { createSettingsPanel } from '../core/ui/SettingsPanel';

export interface HubOptions {
  title: string;
  subtitle: string;
  games: readonly GameModule[];
  /** Si hay menos juegos, se rellenan huecos con tarjetas "Próximamente". */
  minSlots: number;
  settings: SettingsManager;
  onLaunch: (id: string) => void;
}

const INPUT_LABELS: Record<InputKind, string> = {
  keyboard: '⌨️ Teclado',
  touch: '👆 Táctil',
  mouse: '🖱️ Ratón',
};

/** Pantalla de inicio de la colección. Solo conoce los metadatos de cada juego. */
export class GameHub {
  private readonly element: HTMLElement;
  private settingsOverlay: { overlay: Overlay; destroyPanel: () => void } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly options: HubOptions,
  ) {
    const settingsButton = createButton({
      label: 'Ajustes',
      icon: '⚙️',
      variant: 'ghost',
      onClick: () => this.openSettings(),
    });

    const grid = h('div', { className: 'hub__grid' });
    for (const game of options.games) grid.append(this.gameCard(game));
    for (let i = options.games.length; i < options.minSlots; i++) grid.append(this.comingSoonCard());

    this.element = h('main', { className: 'hub' }, [
      h('header', { className: 'hub__header' }, [
        h('div', {}, [
          h('h1', { className: 'hub__title', text: options.title }),
          h('p', { className: 'hub__subtitle', text: options.subtitle }),
        ]),
        settingsButton,
      ]),
      grid,
      h('footer', { className: 'hub__footer', text: 'Juega con una sola mano · Sin registro · Sin anuncios' }),
    ]);
    parent.append(this.element);
  }

  destroy(): void {
    this.closeSettings();
    this.element.remove();
  }

  private gameCard(game: GameModule): HTMLElement {
    const launch = () => this.options.onLaunch(game.id);
    const card = h('article', { className: 'card' }, [
      h('img', { className: 'card__thumb', attrs: { src: game.thumbnail, alt: '', draggable: 'false' } }),
      h('div', { className: 'card__body' }, [
        h('h2', { className: 'card__title', text: game.title }),
        h('p', { className: 'card__desc', text: game.description }),
        h(
          'ul',
          { className: 'card__chips', attrs: { 'aria-label': 'Controles' } },
          game.supportedInputs.map((input) => h('li', { className: 'chip', text: INPUT_LABELS[input] })),
        ),
        createButton({ label: 'Jugar', icon: '▶', onClick: launch, className: 'card__play' }),
      ]),
    ]);
    return card;
  }

  private comingSoonCard(): HTMLElement {
    return h('article', { className: 'card card--soon', attrs: { 'aria-label': 'Próximamente' } }, [
      h('div', { className: 'card__soon-icon', text: '?', attrs: { 'aria-hidden': 'true' } }),
      h('p', { className: 'card__soon-text', text: 'Próximamente' }),
    ]);
  }

  private openSettings(): void {
    if (this.settingsOverlay) return;
    const overlay = new Overlay(document.body, { title: 'Ajustes', onDismiss: () => this.closeSettings() });
    const panel = createSettingsPanel(this.options.settings);
    overlay.body.append(
      panel.element,
      h('div', { className: 'overlay__actions' }, [createButton({ label: 'Cerrar', onClick: () => this.closeSettings() })]),
    );
    this.settingsOverlay = { overlay, destroyPanel: panel.destroy };
  }

  private closeSettings(): void {
    if (!this.settingsOverlay) return;
    this.settingsOverlay.destroyPanel();
    this.settingsOverlay.overlay.destroy();
    this.settingsOverlay = null;
  }
}
