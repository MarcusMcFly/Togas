import type { GameContext } from '../core/contracts/GameContext';
import type { GameSession } from '../core/contracts/GameSession';
import { h } from '../core/ui/dom';
import { CampaignManager, type MissionResult } from './CampaignManager';
import { CAMPAIGN_CONFIG, FAILURE_REASONS } from './config/campaign.config';
import { CAMPAIGN_CHARACTERS, ROSTER } from './config/characters.config';
import { CHAPTERS, UNLOCK_RULES } from './config/progression.config';
import { CampaignUnlockSystem } from './systems/CampaignUnlockSystem';
import { isChapterInDevelopment, nextMission } from './systems/MissionProgressSystem';
import { createIntro, type Screen } from './ui/CampaignIntro';
import { createResults } from './ui/CampaignResults';
import { createBriefing, createChapterMap, type MapAction } from './ui/ChapterMap';
import { createProfile, createRoster } from './ui/CharacterSelection';

interface ActiveMission {
  session: GameSession;
  container: HTMLElement;
}

/**
 * El modo campaña es un orquestador, no una copia de los juegos (spec 10.1): enseña la
 * historia, el plantel y el mapa, y para cada misión monta el minijuego correspondiente
 * con su reglamento de campaña dentro de su propio contenedor.
 *
 * Para el shell es un juego más: la pausa y la salida se delegan en la misión en curso.
 */
export class CampaignSession implements GameSession {
  private readonly root: HTMLElement;
  private readonly manager: CampaignManager;
  private screen: Screen | null = null;
  private mission: ActiveMission | null = null;
  private destroyed = false;

  constructor(private readonly context: GameContext) {
    this.root = h('div', { className: 'campaign' });
    const unlocks = new CampaignUnlockSystem(ROSTER, CAMPAIGN_CHARACTERS, UNLOCK_RULES);
    this.manager = new CampaignManager(context.services.storage, {
      campaignId: CAMPAIGN_CONFIG.id,
      chapters: CHAPTERS,
      characters: CAMPAIGN_CHARACTERS,
      unlocks,
    });
  }

  start(): void {
    this.context.container.append(this.root);
    this.context.setPauseAvailable(false);
    if (!this.manager.state.introSeen) this.showIntro();
    else if (this.manager.state.selectedCharacterId && this.manager.selectedChapter) this.showMap();
    else this.showRoster();
  }

  pause(): void {
    this.mission?.session.pause();
  }

  resume(): void {
    this.mission?.session.resume();
  }

  destroy(): void {
    this.destroyed = true;
    // Salir con una misión a medias la deja como interrumpida (se puede reintentar).
    if (this.mission) this.manager.abandonMission();
    this.unmountMission();
    this.screen?.destroy();
    this.screen = null;
    this.root.remove();
  }

  // ——— Pantallas ———

  private show(screen: Screen | HTMLElement): void {
    this.screen?.destroy();
    const next: Screen = screen instanceof HTMLElement ? { element: screen, destroy: () => screen.remove() } : screen;
    this.screen = next;
    this.root.append(next.element);
    this.root.scrollTop = 0;
    this.context.setPauseAvailable(false);
    const focusable = next.element.querySelector<HTMLElement>('.camp-actions .btn, .btn--primary');
    focusable?.focus({ preventScroll: true });
  }

  private showIntro(): void {
    this.show(createIntro({
      roster: this.manager.roster(),
      onFinish: () => {
        this.manager.markIntroSeen();
        this.showRoster();
      },
    }));
  }

  private showRoster(): void {
    this.show(createRoster({
      slots: this.manager.roster(),
      onPick: (id) => {
        if (this.manager.selectCharacter(id)) this.showProfile();
      },
      onIntro: () => this.showIntro(),
      onExit: () => this.context.exit(),
    }));
  }

  private showProfile(): void {
    const character = this.manager.character(this.manager.state.selectedCharacterId);
    const chapter = this.manager.selectedChapter;
    if (!character || !chapter) {
      this.showRoster();
      return;
    }
    this.show(createProfile({
      character,
      completed: this.manager.attempt?.completedMissionIds.length ?? 0,
      total: chapter.missions.length,
      onContinue: () => this.showMap(),
      onBack: () => this.showRoster(),
    }));
  }

  private showMap(): void {
    // Personaje elegido sin intento (p. ej. se descartó por datos viejos): se crea uno nuevo.
    const selected = this.manager.state.selectedCharacterId;
    if (selected && !this.manager.attempt) this.manager.selectCharacter(selected);
    const chapter = this.manager.selectedChapter;
    const attempt = this.manager.attempt;
    if (!chapter || !attempt) {
      this.showRoster();
      return;
    }
    const mission = this.manager.currentMission();
    const reason = attempt.failure ? FAILURE_REASONS[attempt.failure.reason] ?? attempt.failure.reason : '';
    let action: MapAction;
    if (attempt.status === 'lost') action = { kind: 'restart', reason };
    else if (attempt.status === 'failed' && mission) action = { kind: 'retry', mission, reason, score: attempt.score.currentScore };
    else if (attempt.status === 'ready' && mission) action = { kind: 'start', mission, continuing: attempt.completedMissionIds.length > 0 };
    else action = { kind: 'done', next: chapter.missions.find((m) => !attempt.completedMissionIds.includes(m.id)) ?? null };

    this.show(createChapterMap({
      chapter,
      inDevelopment: isChapterInDevelopment(chapter),
      nodes: this.manager.nodes(),
      summary: this.manager.summary(),
      action,
      onStart: () => this.showBriefing(),
      onRetry: () => {
        if (this.manager.retryMission()) this.showBriefing();
      },
      onRestart: () => {
        if (this.manager.restartChapter()) this.showBriefing();
      },
      onBack: () => this.showRoster(),
      onExit: () => this.context.exit(),
    }));
  }

  private showBriefing(): void {
    const mission = this.manager.currentMission();
    const attempt = this.manager.attempt;
    if (!mission || !attempt || attempt.status !== 'ready') {
      this.showMap();
      return;
    }
    this.show(createBriefing({
      mission,
      startingScore: attempt.score.currentScore,
      onStart: () => void this.launchMission(),
      onBack: () => this.showMap(),
    }));
  }

  private showResults(result: MissionResult): void {
    const chapter = this.manager.selectedChapter;
    const mission = chapter?.missions.find((m) => m.id === result.record.missionId);
    if (!chapter || !mission) {
      this.showMap();
      return;
    }
    const next = result.record.status === 'completed' ? nextMission(chapter, result.attempt.completedMissionIds) : null;
    const upcoming = chapter.missions.find((m) => !result.attempt.completedMissionIds.includes(m.id)) ?? null;
    const reason = result.record.reason;
    this.show(createResults({
      mission,
      record: result.record,
      failure: result.record.status === 'failed' && reason ? FAILURE_REASONS[reason] ?? reason : null,
      attemptLost: result.attempt.status === 'lost',
      next,
      upcoming,
      onNext: () => this.showBriefing(),
      onRetry: () => {
        if (this.manager.retryMission()) this.showBriefing();
      },
      onRestart: () => {
        if (this.manager.restartChapter()) this.showBriefing();
      },
      onMap: () => this.showMap(),
    }));
  }

  // ——— Misiones ———

  private launchMission(): void {
    if (this.mission || this.destroyed) return;
    const run = this.manager.startMission((result) => {
      // Diferido: la misión avisa desde su propio bucle; se desmonta cuando termine ese paso.
      queueMicrotask(() => {
        if (this.destroyed) return;
        this.unmountMission();
        this.showResults(result);
      });
    });
    if (!run) {
      this.showMap();
      return;
    }
    this.screen?.destroy();
    this.screen = null;

    const container = h('div', { className: 'campaign__mission game-stage' });
    this.root.append(container);
    const parent = this.context;
    const missionContext: GameContext = {
      container,
      services: {
        ...parent.services,
        // Almacén propio: jugar la campaña nunca toca récords ni preferencias del modo normal.
        storage: parent.services.storage.scope(`mission:${run.mission.runner.gameId}`),
      },
      exit: () => queueMicrotask(() => this.leaveMission()),
      setPauseAvailable: (available) => {
        if (this.mission?.container === container) parent.setPauseAvailable(available);
      },
      requestPause: () => parent.requestPause(),
      gameTitle: (gameId) => parent.gameTitle(gameId),
      // Desde una misión no se salta a otros juegos: la campaña decide qué viene después.
      launchGame: () => undefined,
    };
    try {
      const session = run.mission.runner.start(missionContext, run.host);
      this.mission = { session, container };
      session.start();
    } catch (error) {
      console.error('[campaign] la misión no pudo arrancar', error);
      this.manager.abandonMission();
      this.unmountMission();
      this.showMap();
    }
  }

  /** La misión pidió salir (no debería en modo campaña): se trata como interrumpida. */
  private leaveMission(): void {
    if (!this.mission) return;
    this.manager.abandonMission();
    this.unmountMission();
    this.showMap();
  }

  private unmountMission(): void {
    const mission = this.mission;
    if (!mission) return;
    this.mission = null;
    try {
      mission.session.destroy();
    } catch (error) {
      console.error('[campaign] error al cerrar la misión', error);
    }
    // Red de seguridad, como hace el shell al cerrar un juego.
    this.context.services.input.disposeAll();
    this.context.services.audio.stopAll();
    mission.container.remove();
    this.context.setPauseAvailable(false);
  }
}
