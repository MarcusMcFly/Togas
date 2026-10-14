import { h } from './dom';

export interface ButtonOptions {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Emoji o símbolo opcional delante del texto. */
  icon?: string;
  /** Si el botón solo muestra un icono, este texto lo describe para lectores de pantalla. */
  ariaLabel?: string;
  className?: string;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const { label, onClick, variant = 'primary', icon, ariaLabel, className } = options;
  const button = h('button', {
    className: ['btn', `btn--${variant}`, className].filter(Boolean).join(' '),
    attrs: { type: 'button', ...(ariaLabel ? { 'aria-label': ariaLabel } : {}) },
  });
  if (icon) button.append(h('span', { className: 'btn__icon', text: icon, attrs: { 'aria-hidden': 'true' } }));
  if (label) button.append(h('span', { text: label }));
  button.addEventListener('click', onClick);
  return button;
}
