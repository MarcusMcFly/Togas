import type { SettingsManager } from '../services/SettingsManager';
import { h } from './dom';

export interface SettingsPanel {
  readonly element: HTMLElement;
  destroy(): void;
}

/** Controles de ajustes globales. Se reutiliza en el hub y en la pausa de cualquier juego. */
export function createSettingsPanel(settings: SettingsManager): SettingsPanel {
  const sound = h('input', { attrs: { type: 'checkbox', role: 'switch' } });
  const volume = h('input', { attrs: { type: 'range', min: '0', max: '100', step: '5' } });
  const motion = h('input', { attrs: { type: 'checkbox', role: 'switch' } });

  sound.addEventListener('change', () => settings.update({ muted: !sound.checked }));
  volume.addEventListener('input', () => settings.update({ volume: Number(volume.value) / 100 }));
  motion.addEventListener('change', () => settings.update({ reducedMotion: motion.checked }));

  const sync = () => {
    const s = settings.current;
    sound.checked = !s.muted;
    volume.value = String(Math.round(s.volume * 100));
    volume.disabled = s.muted;
    motion.checked = s.reducedMotion;
  };
  sync();
  const unsubscribe = settings.subscribe(sync);

  const row = (label: string, hint: string, control: HTMLElement) =>
    h('label', { className: 'setting' }, [
      h('span', { className: 'setting__text' }, [
        h('span', { className: 'setting__label', text: label }),
        h('span', { className: 'setting__hint', text: hint }),
      ]),
      control,
    ]);

  const element = h('div', { className: 'settings' }, [
    row('Sonido', 'Activa o silencia todos los efectos', sound),
    row('Volumen', 'Volumen de los efectos', volume),
    row('Reducir movimiento', 'Sin sacudidas de cámara ni destellos', motion),
  ]);

  return {
    element,
    destroy: () => {
      unsubscribe();
      element.remove();
    },
  };
}
