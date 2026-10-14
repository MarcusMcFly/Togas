/**
 * PLANTILLA DE MINIJUEGO
 *
 * Copia esta carpeta junto a los demás juegos, renómbrala con el ID de tu juego
 * y sustituye esta sesión de ejemplo por la tuya. Es un juego mínimo que cumple
 * el contrato: cuenta pulsaciones durante 10 segundos.
 *
 * No usa Phaser a propósito: el contrato no obliga a ningún motor concreto.
 */
import type { GameContext } from '../../core/contracts/GameContext';
import type { GameModule } from '../../core/contracts/GameModule';
import type { GameSession } from '../../core/contracts/GameSession';
import type { PrimaryAction } from '../../core/services/InputManager';
import { createButton } from '../../core/ui/Button';
import { h } from '../../core/ui/dom';

const DURATION_MS = 10_000;

class TemplateSession implements GameSession {
  private action: PrimaryAction | null = null;
  private timer: number | null = null;
  private remainingMs = DURATION_MS;
  private lastTick = 0;
  private count = 0;
  private readonly countEl = h('div', { className: 'template-game__count', text: '0' });
  private readonly infoEl = h('p', { text: 'Pulsa, toca o haz clic lo más rápido que puedas' });

  constructor(private readonly context: GameContext) {}

  start(): void {
    const { container, services } = this.context;
    container.append(
      h('div', { className: 'template-game' }, [
        h('h2', { text: 'Plantilla de minijuego' }),
        this.infoEl,
        this.countEl,
        createButton({ label: 'Volver al hub', variant: 'secondary', onClick: () => this.context.exit() }),
      ]),
    );

    this.action = services.input.bindPrimaryAction({ target: container, keys: ['Space'] });
    this.action.onPress(() => {
      if (this.remainingMs <= 0) return;
      this.count++;
      this.countEl.textContent = String(this.count);
    });

    this.context.setPauseAvailable(true);
    this.resume();
  }

  pause(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  resume(): void {
    this.lastTick = performance.now();
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  destroy(): void {
    this.pause();
    this.action?.dispose();
    this.context.container.replaceChildren();
  }

  private tick(): void {
    const now = performance.now();
    this.remainingMs -= now - this.lastTick;
    this.lastTick = now;
    if (this.remainingMs > 0) return;
    this.pause();
    this.context.setPauseAvailable(false);
    const best = Math.max(this.count, this.context.services.storage.get('best', 0));
    this.context.services.storage.set('best', best);
    this.infoEl.textContent = `¡Tiempo! Récord: ${best}`;
  }
}

export const templateGame: GameModule = {
  id: 'plantilla',
  title: 'Plantilla (solo desarrollo)',
  version: '0.1.0',
  description: 'Juego mínimo de ejemplo. Demuestra que se puede añadir un juego sin tocar los demás.',
  thumbnail:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#2d2758"/>' +
        '<text x="80" y="58" font-family="sans-serif" font-size="36" font-weight="900" fill="#ffd23f" text-anchor="middle">{ }</text></svg>',
    ),
  supportedInputs: ['keyboard', 'touch', 'mouse'],
  preload: () => Promise.resolve(),
  create: (context) => new TemplateSession(context),
  destroy: () => undefined,
};
