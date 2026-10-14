import Phaser from 'phaser';
import type { PrimaryAction } from '../../../core/services/InputManager';
import { Random } from '../../../core/utils/Random';
import { emissionSound } from '../audio/emissionSounds';
import { antigasSound, countdownBeep, fanfareSound, goBeep, jumpSound, pickupSound, whistleSound } from '../audio/sfx';
import {
  COLLECTIBLES, COLLECTIBLE_HITBOX, OBSTACLES, OBSTACLE_HITBOX,
  type CollectibleDefinition, type ObstacleDefinition,
} from '../config/collectibles.config';
import { SOUND_VARIANTS_PER_TIER, getTierPresentation } from '../config/emission.config';
import { GAME_CONFIG } from '../config/game.config';
import { SPAWN_CONFIG } from '../config/spawn.config';
import { CityBackdrop } from '../entities/CityBackdrop';
import { Collectible } from '../entities/Collectible';
import { Obstacle } from '../entities/Obstacle';
import { PedestrianCrowd } from '../entities/PedestrianCrowd';
import { PigeonFlock } from '../entities/PigeonFlock';
import { Player } from '../entities/Player';
import { EffectsDirector } from '../fx/EffectsDirector';
import type { TogasRuntime } from '../runtime';
import { overlaps, setRect, type Rect } from '../systems/CollisionSystem';
import { EmissionSystem } from '../systems/EmissionSystem';
import { GasSystem, type EmissionEvent } from '../systems/GasSystem';
import { RunnerSystem, minObstacleGap } from '../systems/RunnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { SpawnSystem, type SpawnRequest } from '../systems/SpawnSystem';
import { DEPTH, addText } from '../ui/theme';

/** Lo que el HUD necesita leer en cada frame. */
export interface HudState {
  score: number;
  timeLeft: number;
  gas: number;
  maxGas: number;
  tier: number;
  skinId: string;
}

type State = 'countdown' | 'playing' | 'ending';

const COLLECTIBLE_BY_ID = new Map<string, CollectibleDefinition>(COLLECTIBLES.map((c) => [c.id, c]));
const OBSTACLE_BY_ID = new Map<string, ObstacleDefinition>(OBSTACLES.map((o) => [o.id, o]));
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'] as const;

/**
 * La partida. Orquesta los sistemas (lógica pura) y las entidades (lo que se ve):
 * entrada → RunnerSystem → spawn → colisiones → gas/emisiones/puntos → efectos y HUD.
 */
export class PlayScene extends Phaser.Scene {
  readonly hud: HudState = { score: 0, timeLeft: 0, gas: 0, maxGas: GAME_CONFIG.gas.max, tier: 0, skinId: '' };

  private runner!: RunnerSystem;
  private gas!: GasSystem;
  private emissions!: EmissionSystem;
  private score!: ScoreSystem;
  private spawner!: SpawnSystem;

  private backdrop!: CityBackdrop;
  private player!: Player;
  private pigeons!: PigeonFlock;
  private pedestrians!: PedestrianCrowd;
  private fx!: EffectsDirector;
  private collectibles: Collectible[] = [];
  private obstacles: Obstacle[] = [];
  private hint: Phaser.GameObjects.Text | null = null;

  private action: PrimaryAction | null = null;
  private state: State = 'countdown';
  private elapsed = 0;
  private clock = 0;
  private slowFrames = 0;
  private legendaryAnnounced = false;
  private readonly spawnQueue: SpawnRequest[] = [];
  private readonly playerBox: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly itemBox: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly rt: TogasRuntime) {
    super('play');
  }

  /** Todo el estado se recrea aquí: "Jugar otra vez" empieza de cero sin recargar (AC-10). */
  create(): void {
    const rng = new Random(Date.now());
    const { runner, playerHitbox, gas, view, playerAnchorX } = GAME_CONFIG;

    this.runner = new RunnerSystem(runner);
    this.gas = new GasSystem(gas.max, gas.maxTier);
    this.emissions = new EmissionSystem(SOUND_VARIANTS_PER_TIER, rng);
    this.score = new ScoreSystem(COLLECTIBLES.map((c) => c.id));
    const gap = minObstacleGap(runner, playerHitbox.width, OBSTACLE_HITBOX.width, SPAWN_CONFIG.obstacleMargin);
    this.spawner = new SpawnSystem(SPAWN_CONFIG, COLLECTIBLES, OBSTACLES, rng, gap);

    this.state = 'countdown';
    this.elapsed = 0;
    this.clock = 0;
    this.slowFrames = 0;
    this.legendaryAnnounced = false;
    this.collectibles = [];
    this.obstacles = [];
    this.spawnQueue.length = 0;

    this.backdrop = new CityBackdrop(this);
    this.pigeons = new PigeonFlock(this);
    this.pedestrians = new PedestrianCrowd(this);
    this.player = new Player(this, this.rt.skin, view.width * playerAnchorX);
    this.player.idle();
    this.fx = new EffectsDirector(this);

    Object.assign(this.hud, {
      score: 0, timeLeft: GAME_CONFIG.session.durationSec, gas: 0, tier: 0, skinId: this.rt.skin.id,
    });
    this.scene.launch('hud', { state: this.hud });

    this.action = this.rt.context.services.input.bindPrimaryAction({ target: this.rt.context.container, keys: JUMP_KEYS });
    this.action.onPress(() => {
      if (this.state === 'playing') this.runner.pressJump();
    });
    this.action.onRelease(() => this.runner.releaseJump());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    this.rt.context.setPauseAvailable(true);
    this.startCountdown();
  }

  update(_time: number, deltaMs: number): void {
    // Limitar dt evita saltos enormes tras un tirón del navegador.
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.clock += dt;
    this.monitorPerformance(deltaMs);

    if (this.state === 'countdown') {
      this.backdrop.setScroll(0, this.clock);
      return;
    }

    const duration = GAME_CONFIG.session.durationSec;
    if (this.state === 'playing') {
      this.elapsed = Math.min(this.elapsed + dt, duration);
      if (this.elapsed >= duration) this.endSession();
    }
    const progress = this.elapsed / duration;

    this.runner.update(dt, progress);
    if (this.runner.justJumped) this.rt.play(jumpSound);
    if (this.runner.justLanded) this.player.showPose('land', 120);

    const distance = this.runner.distance;
    this.backdrop.setScroll(distance, this.clock);
    this.pigeons.update(distance, dt);
    this.pedestrians.update(distance, dt);
    if (this.state === 'playing') this.spawnUpTo(distance + GAME_CONFIG.view.width + 80, progress);
    this.updateWorldObjects(distance);
    this.player.update(this.runner);

    this.hud.score = this.score.score;
    this.hud.timeLeft = duration - this.elapsed;
    this.hud.gas = this.gas.current;
    this.hud.tier = this.gas.intensityTier;
  }

  private startCountdown(): void {
    const { width, height } = GAME_CONFIG.view;
    const steps = GAME_CONFIG.session.countdownSteps;
    this.hint = addText(this, width / 2, height * 0.62, 'Toca la pantalla o pulsa ESPACIO para saltar\nMantén pulsado para saltar más alto', 22, {
      color: '#ffffff', stroke: 5,
    }).setDepth(DEPTH.text);

    for (let i = 0; i <= steps; i++) {
      this.time.delayedCall(i * 700, () => {
        if (i < steps) {
          this.fx.banner(String(steps - i), 110, '#ffd23f', 200);
          this.rt.play(countdownBeep);
          return;
        }
        this.fx.banner('¡YA!', 110, '#8bd450', 200);
        this.rt.play(goBeep);
        this.state = 'playing';
        if (this.hint) this.tweens.add({ targets: this.hint, alpha: 0, delay: 2500, duration: 600 });
      });
    }
  }

  private spawnUpTo(horizon: number, progress: number): void {
    this.spawnQueue.length = 0;
    this.spawner.update(horizon, progress, this.spawnQueue);
    for (const request of this.spawnQueue) {
      if (request.kind === 'collectible') {
        const def = COLLECTIBLE_BY_ID.get(request.typeId);
        if (def) acquire(this.collectibles, () => new Collectible(this)).activate(def, request.x, request.height);
      } else {
        const def = OBSTACLE_BY_ID.get(request.typeId);
        if (def) acquire(this.obstacles, () => new Obstacle(this)).activate(def, request.x, request.height);
      }
    }
  }

  private updateWorldObjects(distance: number): void {
    const { playerHitbox, view, playerAnchorX } = GAME_CONFIG;
    setRect(this.playerBox, view.width * playerAnchorX, this.runner.height, playerHitbox.width, playerHitbox.height);
    const checkCollisions = this.state === 'playing';

    for (const item of this.collectibles) {
      if (!item.active) continue;
      const screenX = item.worldX - distance;
      item.place(screenX, this.clock);
      if (screenX < -80) {
        item.deactivate();
        continue;
      }
      if (!checkCollisions || item.consumed) continue;
      const { width, height } = COLLECTIBLE_HITBOX;
      setRect(this.itemBox, screenX, item.height - height / 2, width, height);
      if (overlaps(this.playerBox, this.itemBox)) this.collect(item);
    }

    for (const obstacle of this.obstacles) {
      if (!obstacle.active) continue;
      const screenX = obstacle.worldX - distance;
      obstacle.place(screenX, this.clock);
      if (screenX < -80) {
        obstacle.deactivate();
        continue;
      }
      if (!checkCollisions || obstacle.consumed) continue;
      setRect(this.itemBox, screenX, 0, OBSTACLE_HITBOX.width, OBSTACLE_HITBOX.height);
      if (overlaps(this.playerBox, this.itemBox)) this.hitObstacle(obstacle);
    }
  }

  private collect(item: Collectible): void {
    const def = item.def;
    this.rt.play(pickupSound(this.gas.ratio));
    item.pickup();
    this.score.addCollectible(def.id, def.score);
    this.fx.floatingScore(`+${def.score}`, item.sprite.x, item.sprite.y - 24);
    this.fx.sparkle(item.sprite.x, item.sprite.y);
    this.player.showPose('collect', 220);
    this.rt.events.emit('collect', { def });
    for (const event of this.gas.add(def.gas)) this.triggerEmission(event);
  }

  private hitObstacle(obstacle: Obstacle): void {
    const def = obstacle.def;
    const x = obstacle.sprite.x;
    obstacle.deflate();
    this.gas.reduce(def.gasPenalty);
    this.score.recordObstacleHit();
    this.rt.play(antigasSound);
    this.fx.fizz(x, GAME_CONFIG.groundY - 24);
    this.fx.floatingScore(`−${def.gasPenalty} gas`, x, GAME_CONFIG.groundY - 80, '#ff8fa3');
    this.player.showPose('hit', 350);
    this.player.flash(0xff9aa8, 180);
    this.recoil(-14);
    this.rt.events.emit('obstacle', { def });
  }

  private triggerEmission(event: EmissionEvent): void {
    const emission = this.emissions.resolve(event);
    const presentation = getTierPresentation(emission.tier);
    const isBurp = emission.type === 'burp';

    this.score.recordEmission(emission.type, emission.tier);
    this.rt.play(emissionSound(this.rt.skin, emission), 'emission');
    this.fx.emission(emission, isBurp ? this.player.mouth : this.player.rear, this.rt.reducedMotion);

    const pose = emission.tier >= 4 && isBurp ? 'strong' : emission.type;
    this.player.showPose(pose, 350 + emission.tier * 90);
    // Retroceso visual: el eructo empuja hacia atrás y el pedo, hacia delante.
    this.recoil(isBurp ? -presentation.recoil : presentation.recoil);
    if (presentation.scareBirds) this.pigeons.scare(this.player.sprite.x, presentation.celebrate ? 4 : 0);
    if (!isBurp) this.pedestrians.react(this.player.sprite.x, emission.tier, this.rt.reducedMotion);

    if (emission.tier === GAME_CONFIG.gas.maxTier && !this.legendaryAnnounced) {
      this.legendaryAnnounced = true;
      this.time.delayedCall(450, () => {
        this.fx.banner('¡NIVEL LEGENDARIO!', 52, '#ff4d6d', 900);
        this.rt.play(fanfareSound);
      });
    }
    this.rt.events.emit('emission', emission);
  }

  private recoil(px: number): void {
    this.tweens.killTweensOf(this.player);
    this.player.offsetX = 0;
    this.tweens.add({ targets: this.player, offsetX: px, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  private endSession(): void {
    this.state = 'ending';
    this.rt.context.setPauseAvailable(false);
    this.runner.releaseJump();
    this.rt.play(whistleSound);
    this.fx.banner('¡TIEMPO!', 90, '#ffd23f', 900);
    this.rt.finishSession(this.score.snapshot());
    this.time.delayedCall(1700, () => this.scene.start('results'));
  }

  /** Si el juego va lento de forma sostenida, se reducen los efectos no esenciales. */
  private monitorPerformance(deltaMs: number): void {
    this.slowFrames = deltaMs > 25 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90) this.fx.lowQuality = true;
  }

  private cleanup(): void {
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.action?.dispose();
    this.action = null;
    this.hint = null;
    if (this.scene.isActive('hud')) this.scene.stop('hud');
  }
}

function acquire<T extends { active: boolean }>(pool: T[], make: () => T): T {
  for (const item of pool) if (!item.active) return item;
  const item = make();
  pool.push(item);
  return item;
}
