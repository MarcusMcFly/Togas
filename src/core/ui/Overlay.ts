import { h } from './dom';

export interface OverlayOptions {
  title: string;
  /** Si se indica, clicar fuera del panel lo cierra. */
  onDismiss?: () => void;
}

/** Panel modal centrado sobre un fondo oscurecido. */
export class Overlay {
  readonly element: HTMLElement;
  /** Zona donde se añade el contenido del panel. */
  readonly body: HTMLElement;

  constructor(parent: HTMLElement, options: OverlayOptions) {
    this.body = h('div', { className: 'overlay__body' });
    const panel = h('div', { className: 'overlay__panel', attrs: { role: 'dialog', 'aria-modal': 'true' } }, [
      h('h2', { className: 'overlay__title', text: options.title }),
      this.body,
    ]);
    this.element = h('div', { className: 'overlay' }, [panel]);
    if (options.onDismiss) {
      const dismiss = options.onDismiss;
      this.element.addEventListener('click', (e) => {
        if (e.target === this.element) dismiss();
      });
    }
    // Que tocar el modal no cuente como "saltar" en el juego de debajo.
    this.element.addEventListener('pointerdown', (e) => e.stopPropagation());
    parent.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }
}
