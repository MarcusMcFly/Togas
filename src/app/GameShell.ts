import type { GameContext } from '../core/contracts/GameContext';
import type { GameModule } from '../core/contracts/GameModule';
import type { GameSession } from '../core/contracts/GameSession';
import type { AudioManager } from '../core/services/AudioManager';
import type { CampusRunManager } from '../core/services/CampusRunManager';
import type { InputManager } from '../core/services/InputManager';
import type { SaveManager } from '../core/services/SaveManager';
import type { SettingsManager } from '../core/services/SettingsManager';
import { createButton } from '../core/ui/Button';
import { h } from '../core/ui/dom';
import { Overlay } from '../core/ui/Overlay';
import { createSettingsPanel } from '../core/ui/SettingsPanel';
import { GameHub } from './GameHub';
import type { GameRegistry } from './GameRegistry';

export interface ShellServices {
  input: InputManager;
  audio: AudioManager;
  settings: SettingsManager;
  save: SaveManager;
  campusRun: CampusRunManager;
}

export interface ShellBranding {
  title: string;
  subtitle: string;
}

interface ActiveGame {
  module: GameModule;
  session: GameSession | null;
  frame: HTMLElement;
  pauseButton: HTMLButtonElement;
  pauseAvailable: boolean;
  pause: { overlay: Overlay; destroyPanel: () => void } | null;
}

/**
 * Capa 1: arranca la app, muestra el hub y gestiona el ciclo de vida de los juegos.
 * No sabe nada de fabes, eructos ni obstáculos: solo habla con el contrato GameModule.
 */
export class GameShell {
  private hub: GameHub | null = null;
  private active: ActiveGame | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly registry: GameRegistry,
    private readonly services: ShellServices,
    private readonly branding: ShellBranding,
  ) {}

  start(): void {
    // El audio solo puede arrancar tras un gesto del usuario.
    const unlock = () => this.services.audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (!this.active) return;
      if (this.active.pause) this.resume();
      else this.pause();
    });
    // Si el jugador cambia de pestaña, se pausa solo.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });

    this.showHub();
  }

  private showHub(): void {
    this.hub = new GameHub(this.root, {
      ...this.branding,
      games: this.registry.list(),
      minSlots: 3,
      settings: this.services.settings,
      onLaunch: (id) => void this.launch(id),
    });
  }

  private async launch(id: string): Promise<void> {
    const module = this.registry.get(id);
    if (!module || this.active) return;

    this.hub?.destroy();
    this.hub = null;

    const stage = h('div', { className: 'game-stage' });
    const loading = h('div', { className: 'game-loading', text: 'Cargando…' });
    const pauseButton = createButton({
      label: '',
      icon: '⏸',
      ariaLabel: 'Pausa',
      variant: 'secondary',
      className: 'pause-button',
      onClick: () => this.pause(),
    });
    // Pulsar el botón de pausa no debe contar como acción dentro del juego.
    pauseButton.addEventListener('pointerdown', (e) => e.stopPropagation());
    pauseButton.hidden = true;
    const frame = h('div', { className: 'game-frame' }, [stage, loading, pauseButton]);
    this.root.append(frame);

    const active: ActiveGame = { module, session: null, frame, pauseButton, pauseAvailable: false, pause: null };
    this.active = active;

    try {
      await module.preload();
      if (this.active !== active) return; // El jugador salió mientras cargaba.
      loading.remove();

      const context: GameContext = {
        container: stage,
        services: {
          input: this.services.input,
          audio: this.services.audio,
          settings: this.services.settings,
          storage: this.services.save.scope(`game:${module.id}`),
          campusRun: this.services.campusRun,
        },
        exit: () => {
          // Diferido: el juego puede pedir salir desde dentro de su propio bucle.
          if (this.active === active) queueMicrotask(() => this.exitToHub(active));
        },
        requestPause: () => {
          if (this.active === active) this.pause();
        },
        gameTitle: (gameId) => this.registry.get(gameId)?.title ?? null,
        launchGame: (gameId) => {
          if (this.active !== active || !this.registry.get(gameId)) return;
          queueMicrotask(() => {
            if (this.active !== active) return;
            this.teardown(active);
            void this.launch(gameId);
          });
        },
        setPauseAvailable: (available) => {
          active.pauseAvailable = available;
          active.pauseButton.hidden = !available;
        },
      };
      active.session = module.create(context);
      active.session.start();
    } catch (error) {
      this.showError(active, error);
    }
  }

  private exitToHub(active: ActiveGame): void {
    if (this.active !== active) return;
    this.teardown(active);
    this.showHub();
  }

  /** Cierra el juego activo y lo limpia todo, sin decidir qué se muestra después. */
  private teardown(active: ActiveGame): void {
    this.active = null;

    this.closePauseOverlay(active);
    try {
      active.session?.destroy();
      active.module.destroy();
    } catch (error) {
      console.error('[shell] error al cerrar el juego', error);
    }
    // Red de seguridad: aunque el juego olvide limpiar algo, no quedan listeners ni sonidos vivos.
    this.services.input.disposeAll();
    this.services.audio.stopAll();
    this.services.audio.resume();
    active.frame.remove();
  }

  private pause(): void {
    const active = this.active;
    if (!active?.session || !active.pauseAvailable || active.pause) return;
    active.session.pause();
    this.services.audio.suspend();

    const overlay = new Overlay(active.frame, { title: 'Pausa' });
    const panel = createSettingsPanel(this.services.settings);
    overlay.body.append(
      panel.element,
      h('div', { className: 'overlay__actions' }, [
        createButton({ label: 'Volver al hub', variant: 'secondary', onClick: () => this.exitToHub(active) }),
        createButton({ label: 'Continuar', icon: '▶', onClick: () => this.resume() }),
      ]),
    );
    active.pause = { overlay, destroyPanel: panel.destroy };
  }

  private resume(): void {
    const active = this.active;
    if (!active?.pause) return;
    this.closePauseOverlay(active);
    this.services.audio.resume();
    active.session?.resume();
  }

  private closePauseOverlay(active: ActiveGame): void {
    if (!active.pause) return;
    active.pause.destroyPanel();
    active.pause.overlay.destroy();
    active.pause = null;
  }

  private showError(active: ActiveGame, error: unknown): void {
    console.error('[shell] el juego no pudo arrancar', error);
    const overlay = new Overlay(active.frame, { title: 'Algo ha fallado' });
    overlay.body.append(
      h('p', { text: 'El juego no se ha podido cargar. Prueba a volver al hub e intentarlo de nuevo.' }),
      h('div', { className: 'overlay__actions' }, [
        createButton({ label: 'Volver al hub', onClick: () => this.exitToHub(active) }),
      ]),
    );
  }
}
