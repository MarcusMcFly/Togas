import Phaser from 'phaser';
import type { GestureBinding } from '../../../core/services/GestureInput';
import type { PrimaryAction } from '../../../core/services/InputManager';
import { clamp } from '../../../core/utils/math';
import { Random } from '../../../core/utils/Random';
import { ART_SCALE, LANDMARKS } from '../art/textures';
import { emissionSound } from '../audio/emissionSounds';
import {
  antigasSound, bumpSound, cleanEmissionSound, countdownBeep, fanfareSound, goBeep, jumpSound, pickupSound, rollSound,
  sirenSound, whistleSound,
} from '../audio/sfx';
import {
  COLLECTIBLE_HITBOX, OBSTACLES, OBSTACLE_HITBOX, type CollectibleDefinition, type ObstacleDefinition,
} from '../config/collectibles.config';
import { SOUND_VARIANTS_PER_TIER, getTierPresentation } from '../config/emission.config';
import { GAME_CONFIG } from '../config/game.config';
import type { LandmarkId } from '../config/ruleset';
import { traversalById, type TraversalObstacleDefinition } from '../config/traversal.config';
import { Barrier } from '../entities/Barrier';
import { CityBackdrop } from '../entities/CityBackdrop';
import { Collectible } from '../entities/Collectible';
import { Obstacle } from '../entities/Obstacle';
import { PedestrianCrowd } from '../entities/PedestrianCrowd';
import { PigeonFlock } from '../entities/PigeonFlock';
import { Player } from '../entities/Player';
import { PoliceEscort } from '../entities/PoliceEscort';
import { EffectsDirector } from '../fx/EffectsDirector';
import type { TogasRuntime, WalkingMissionStats } from '../runtime';
import { overlaps, setRect, type Rect } from '../systems/CollisionSystem';
import { EmissionSystem, alternatingPolicy } from '../systems/EmissionSystem';
import { GasSystem, type EmissionEvent } from '../systems/GasSystem';
import { RunnerSystem, minObstacleGap } from '../systems/RunnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { SpawnSystem, type SpawnRequest } from '../systems/SpawnSystem';
import { StreetSystem } from '../systems/StreetSystem';
import { ViewDirection } from '../systems/ViewDirection';
import { DEPTH, addText } from '../ui/theme';

/** Lo que el HUD necesita leer en cada frame. */
export interface HudState {
  score: number;
  timeLeft: number;
  gas: number;
  maxGas: number;
  tier: number;
  skinId: string;
  /** Solo con meta por distancia y reglas de calle (campaña). */
  street: StreetHud | null;
}

export interface StreetHud {
  progress: number;
  multiplier: number;
  /** `police`: estrellas de búsqueda. `points`: los testigos cuestan puntos. */
  penalty: 'police' | 'points';
  wanted: number;
  maxWanted: number;
  /** Pedos con testigos (penalización por puntos). */
  witnessed: number;
  destination: LandmarkId;
  /** Se avanza hacia la izquierda: la barra de progreso se llena en ese sentido. */
  reversed: boolean;
}

/** Edificio de salida o llegada colocado en el mundo. */
interface Landmark {
  image: Phaser.GameObjects.Image;
  /** X lógica de su puerta. */
  worldX: number;
}

type State = 'countdown' | 'playing' | 'ending' | 'arrest';

const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'] as const;
const ROLL_KEYS = ['ArrowDown', 'KeyS'] as const;
/** La generación se detiene antes de la meta para que la llegada quede despejada. */
const GOAL_CLEARANCE = 520;
/** Distancia de la puerta del edificio de salida por detrás del jugador. */
const ORIGIN_BEHIND = 220;
/** Frenada al llegar a la meta (px/s²). */
const BRAKE_DECEL = 320;
/** Tinte de penumbra para el arte de día en un nivel de noche. */
const NIGHT_TINT = 0x8f93c8;

/**
 * La partida. Orquesta los sistemas (lógica pura) y las entidades (lo que se ve):
 * entrada → RunnerSystem → spawn → colisiones → gas/emisiones/puntos → efectos y HUD.
 * Las diferencias entre modos salen del reglamento (`rt.ruleset`), no de la escena.
 */
export class PlayScene extends Phaser.Scene {
  readonly hud: HudState = { score: 0, timeLeft: 0, gas: 0, maxGas: GAME_CONFIG.gas.max, tier: 0, skinId: '', street: null };

  private runner!: RunnerSystem;
  private gas!: GasSystem;
  private emissions!: EmissionSystem;
  private score!: ScoreSystem;
  private spawner!: SpawnSystem;
  private street: StreetSystem | null = null;

  private backdrop!: CityBackdrop;
  private player!: Player;
  private pigeons!: PigeonFlock;
  private pedestrians!: PedestrianCrowd;
  private fx!: EffectsDirector;
  private landmarks: Landmark[] = [];
  private view = new ViewDirection();
  private collectibles: Collectible[] = [];
  private obstacles: Obstacle[] = [];
  private barriers: Barrier[] = [];
  private hint: Phaser.GameObjects.Text | null = null;

  private catalog = new Map<string, CollectibleDefinition>();
  private obstacleDefs = new Map<string, ObstacleDefinition>(OBSTACLES.map((o) => [o.id, o]));
  private barrierDefs = new Map<string, TraversalObstacleDefinition>();
  private action: PrimaryAction | null = null;
  private gestures: GestureBinding | null = null;
  private state: State = 'countdown';
  private elapsed = 0;
  private clock = 0;
  private slowFrames = 0;
  private legendaryAnnounced = false;
  private braking = false;
  private escorting = false;
  private stumbles = 0;
  /** Puntos de campaña perdidos por pedos con testigos. */
  private pointsLost = 0;
  private finished = false;
  private readonly spawnQueue: SpawnRequest[] = [];
  private readonly playerBox: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly itemBox: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly rt: TogasRuntime) {
    super('play');
  }

  /** Todo el estado se recrea aquí: "Jugar otra vez" empieza de cero sin recargar (AC-10). */
  create(): void {
    const rng = new Random(Date.now());
    const rules = this.rt.ruleset;
    const { runner, playerHitbox, gas, view, playerAnchorX } = GAME_CONFIG;

    this.catalog = new Map(rules.collectibles.map((c) => [c.id, c]));
    this.barrierDefs = new Map();
    for (const id of rules.traversal) {
      const def = traversalById(id);
      if (def) this.barrierDefs.set(id, def);
    }
    const barrierList = [...this.barrierDefs.values()];

    this.street = rules.street ? new StreetSystem(rules.street) : null;
    this.runner = new RunnerSystem(runner);
    const topSpeed = rules.street ? Math.max(runner.maxSpeed, rules.street.speedBoost.maxSpeed) : runner.maxSpeed;
    this.runner.speedCap = topSpeed;
    this.gas = new GasSystem(gas.max, gas.maxTier);
    this.emissions = new EmissionSystem(SOUND_VARIANTS_PER_TIER, rng, rules.emissions === 'fartOnly' ? () => 'fart' : alternatingPolicy);
    this.score = new ScoreSystem(rules.collectibles.map((c) => c.id));
    // El hueco mínimo entre obstáculos se calcula con el más ancho y a la velocidad tope real.
    const widest = Math.max(OBSTACLE_HITBOX.width, ...barrierList.map((b) => b.hitbox.width));
    const gap = minObstacleGap({ ...runner, maxSpeed: topSpeed }, playerHitbox.width, widest, rules.spawn.obstacleMargin);
    this.spawner = new SpawnSystem(rules.spawn, rules.collectibles, OBSTACLES, rng, gap, {
      jump: barrierList.filter((b) => b.action === 'jump'),
      roll: barrierList.filter((b) => b.action === 'roll'),
    });

    this.state = 'countdown';
    this.elapsed = 0;
    this.clock = 0;
    this.slowFrames = 0;
    this.legendaryAnnounced = false;
    this.braking = false;
    this.escorting = false;
    this.stumbles = 0;
    this.pointsLost = 0;
    this.finished = false;
    this.collectibles = [];
    this.obstacles = [];
    this.barriers = [];
    this.spawnQueue.length = 0;

    this.view = new ViewDirection(rules.direction === 'reverse');
    this.backdrop = new CityBackdrop(this, { night: rules.night, reversed: this.view.reversed });
    this.landmarks = [];
    if (rules.goal.kind === 'distance') {
      const { goal } = rules;
      if (goal.origin) this.addLandmark(goal.origin, this.playerX - ORIGIN_BEHIND);
      this.addLandmark(goal.destination, goal.distance + this.playerX);
    }
    this.pigeons = new PigeonFlock(this, this.view);
    this.pedestrians = new PedestrianCrowd(this, { bothWays: rules.pedestriansBothWays, view: this.view });
    this.player = new Player(this, this.rt.skin, view.width * playerAnchorX, this.view);
    this.player.idle();
    this.fx = new EffectsDirector(this, this.view.facing);

    Object.assign(this.hud, {
      score: this.rt.mission?.host.score ?? 0,
      timeLeft: rules.goal.kind === 'time' ? rules.goal.durationSec : 0,
      gas: 0,
      tier: 0,
      skinId: this.rt.skin.id,
      street: this.street && rules.street && rules.goal.kind === 'distance'
        ? {
          progress: 0,
          multiplier: this.street.multiplier,
          penalty: rules.street.witnessPenalty.kind,
          wanted: 0,
          maxWanted: this.street.maxWanted,
          witnessed: 0,
          destination: rules.goal.destination,
          reversed: this.view.reversed,
        }
        : null,
    });
    this.scene.launch('hud', { state: this.hud });

    this.bindInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    this.rt.context.setPauseAvailable(true);
    this.rt.mission?.host.report({ type: 'MISSION_STARTED', missionId: this.rt.mission.host.context.missionId });
    this.startCountdown();
  }

  update(_time: number, deltaMs: number): void {
    // Limitar dt evita saltos enormes tras un tirón del navegador.
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.clock += dt;
    this.monitorPerformance(deltaMs);

    if (this.state === 'countdown') {
      this.backdrop.setScroll(0, this.clock);
      this.placeLandmarks(0);
      return;
    }

    const goal = this.rt.ruleset.goal;
    if (this.state === 'playing') {
      this.elapsed += dt;
      if (goal.kind === 'time' && this.elapsed >= goal.durationSec) {
        this.elapsed = goal.durationSec;
        this.endSession();
      }
    }
    const progress = goal.kind === 'time' ? this.elapsed / goal.durationSec : clamp(this.runner.distance / goal.distance, 0, 1);

    if (this.street) {
      this.street.update(dt);
      this.runner.speedBonus = this.street.boost;
    }
    if (this.braking || this.state === 'arrest') this.runner.speedCap = Math.max(0, this.runner.speed - BRAKE_DECEL * dt);

    this.runner.update(dt, progress);
    if (this.runner.justJumped) this.rt.play(jumpSound);
    if (this.runner.justRolled) {
      this.rt.play(rollSound);
      this.fx.dust(this.player.sprite.x, GAME_CONFIG.groundY - 6);
    }
    if (this.runner.justLanded) this.player.showPose('land', 120);

    const distance = this.runner.distance;
    this.backdrop.setScroll(distance, this.clock);
    this.pigeons.update(distance, dt);
    this.pedestrians.update(distance, dt);
    if (this.state === 'playing') this.spawnUpTo(this.spawnHorizon(distance), progress);
    this.updateWorldObjects(distance);
    if (!this.escorting) this.player.update(this.runner);

    // Se empieza a frenar a tiempo para pararse justo en la puerta.
    const brakingDistance = (this.runner.speed * this.runner.speed) / (2 * BRAKE_DECEL);
    if (goal.kind === 'distance' && this.state === 'playing' && distance + brakingDistance >= goal.distance) this.arrive();

    this.hud.score = this.rt.mission?.host.score ?? this.score.score;
    this.hud.timeLeft = goal.kind === 'time' ? goal.durationSec - this.elapsed : 0;
    this.hud.gas = this.gas.current;
    this.hud.tier = this.gas.intensityTier;
    if (this.street && this.hud.street) {
      this.hud.street.progress = progress;
      this.hud.street.multiplier = this.street.multiplier;
      this.hud.street.wanted = this.street.wanted;
      this.hud.street.witnessed = this.street.witnessedEmissions;
    }
  }

  private addLandmark(id: LandmarkId, worldX: number): void {
    const { key, canvas } = LANDMARKS[id];
    const image = this.add
      .image(0, GAME_CONFIG.groundY, key)
      .setOrigin(0.5, canvas.groundY / canvas.height)
      .setScale(1 / ART_SCALE)
      .setDepth(DEPTH.street + 0.5)
      .setVisible(false);
    // De noche, los edificios dibujados de día se ven en penumbra (la casa ya se dibuja de noche).
    if (this.rt.ruleset.night && !canvas.night) image.setTint(NIGHT_TINT);
    this.landmarks.push({ image, worldX });
  }

  private bindInput(): void {
    const { input } = this.rt.context.services;
    const target = this.rt.context.container;
    if (this.rt.ruleset.controls === 'tapAndSwipe') {
      // Un dedo: tocar = saltar (siempre alto), deslizar hacia abajo = rodar.
      this.gestures = input.bindGestures({ target, tapKeys: JUMP_KEYS, swipeDownKeys: ROLL_KEYS });
      this.gestures.onGesture((gesture) => {
        if (this.state !== 'playing') return;
        if (gesture === 'tap') this.runner.pressJump();
        else this.runner.pressRoll();
      });
      return;
    }
    this.action = input.bindPrimaryAction({ target, keys: JUMP_KEYS });
    this.action.onPress(() => {
      if (this.state === 'playing') this.runner.pressJump();
    });
    this.action.onRelease(() => this.runner.releaseJump());
  }

  private spawnHorizon(distance: number): number {
    const horizon = distance + GAME_CONFIG.view.width + 80;
    const goal = this.rt.ruleset.goal;
    if (goal.kind !== 'distance') return horizon;
    return Math.min(horizon, goal.distance + this.playerX - GOAL_CLEARANCE);
  }

  private get playerX(): number {
    return GAME_CONFIG.view.width * GAME_CONFIG.playerAnchorX;
  }

  private startCountdown(): void {
    const { width, height } = GAME_CONFIG.view;
    const steps = GAME_CONFIG.session.countdownSteps;
    const text = this.rt.ruleset.controls === 'tapAndSwipe'
      ? 'Toca para saltar · Desliza hacia abajo para rodar\n(ESPACIO salta · ↓ rueda)'
      : 'Toca la pantalla o pulsa ESPACIO para saltar\nMantén pulsado para saltar más alto';
    this.hint = addText(this, width / 2, height * 0.62, text, 22, { color: '#ffffff', stroke: 5 }).setDepth(DEPTH.text);

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
        const def = this.catalog.get(request.typeId);
        if (def) acquire(this.collectibles, () => new Collectible(this)).activate(def, request.x, request.height);
      } else if (request.kind === 'obstacle') {
        const def = this.obstacleDefs.get(request.typeId);
        if (def) acquire(this.obstacles, () => new Obstacle(this)).activate(def, request.x, request.height);
      } else {
        const def = this.barrierDefs.get(request.typeId);
        if (def) acquire(this.barriers, () => new Barrier(this)).activate(def, request.x, 0);
      }
    }
  }

  private updateWorldObjects(distance: number): void {
    const { playerHitbox, rollHitboxHeight } = GAME_CONFIG;
    const height = this.runner.rolling ? rollHitboxHeight : playerHitbox.height;
    setRect(this.playerBox, this.playerX, this.runner.height, playerHitbox.width, height);
    const checkCollisions = this.state === 'playing';

    for (const item of this.collectibles) {
      if (!item.active) continue;
      const screenX = item.worldX - distance;
      item.place(this.view.x(screenX), this.clock);
      if (screenX < -80) {
        item.deactivate();
        continue;
      }
      if (!checkCollisions || item.consumed) continue;
      const { width, height: h } = COLLECTIBLE_HITBOX;
      setRect(this.itemBox, screenX, item.height - h / 2, width, h);
      if (overlaps(this.playerBox, this.itemBox)) this.collect(item);
    }

    for (const obstacle of this.obstacles) {
      if (!obstacle.active) continue;
      const screenX = obstacle.worldX - distance;
      obstacle.place(this.view.x(screenX), this.clock);
      if (screenX < -80) {
        obstacle.deactivate();
        continue;
      }
      if (!checkCollisions || obstacle.consumed) continue;
      setRect(this.itemBox, screenX, 0, OBSTACLE_HITBOX.width, OBSTACLE_HITBOX.height);
      if (overlaps(this.playerBox, this.itemBox)) this.hitObstacle(obstacle);
    }

    for (const barrier of this.barriers) {
      if (!barrier.active) continue;
      const screenX = barrier.worldX - distance;
      barrier.place(this.view.x(screenX), this.clock);
      if (screenX < -160) {
        barrier.deactivate();
        continue;
      }
      if (!checkCollisions || barrier.consumed) continue;
      const box = barrier.def.hitbox;
      setRect(this.itemBox, screenX, box.bottom, box.width, box.height);
      if (overlaps(this.playerBox, this.itemBox)) this.hitBarrier(barrier);
    }

    this.placeLandmarks(distance);
  }

  /** La puerta de la meta queda justo a la altura del jugador cuando se alcanza. */
  private placeLandmarks(distance: number): void {
    for (const landmark of this.landmarks) {
      const x = landmark.worldX - distance;
      landmark.image.setX(this.view.x(x)).setVisible(x > -300 && x < GAME_CONFIG.view.width + 300);
    }
  }

  private collect(item: Collectible): void {
    const def = item.def;
    const itemMultiplier = this.rt.ruleset.itemMultipliers[def.id] ?? 1;
    const points = this.street ? this.street.points(def.score, itemMultiplier) : Math.round(def.score * itemMultiplier);
    this.rt.play(pickupSound(this.gas.ratio));
    item.pickup();
    this.score.addCollectible(def.id, points);
    this.rt.mission?.host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: points });
    const special = itemMultiplier > 1;
    this.fx.floatingScore(special ? `+${points} ×${itemMultiplier}` : `+${points}`, item.sprite.x, item.sprite.y - 24, special ? '#ff9f1c' : '#ffd23f');
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

  /** Tropiezo con una valla o un andamio: sin puntos perdidos, pero adiós al multiplicador y al acelerón. */
  private hitBarrier(barrier: Barrier): void {
    barrier.bump();
    this.stumbles++;
    this.street?.stumble();
    this.rt.play(bumpSound);
    this.player.showPose('hit', 420);
    this.player.flash(0xff9aa8, 220);
    this.recoil(-20);
    if (!this.rt.reducedMotion) this.cameras.main.shake(140, 0.004);
    this.fx.floatingScore(this.street ? '¡Tropiezo! ×1' : '¡Tropiezo!', this.player.sprite.x, GAME_CONFIG.groundY - 130, '#ff8fa3');
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

    const rules = this.rt.ruleset.street;
    if (this.street && rules && !isBurp) {
      this.judgeEmission(rules.emissionRadius);
    } else if (!isBurp) {
      this.pedestrians.react(this.player.sprite.x, emission.tier, this.rt.reducedMotion);
    }

    if (emission.tier === GAME_CONFIG.gas.maxTier && !this.legendaryAnnounced && !this.street) {
      this.legendaryAnnounced = true;
      this.time.delayedCall(450, () => {
        this.fx.banner('¡NIVEL LEGENDARIO!', 52, '#ff4d6d', 900);
        this.rt.play(fanfareSound);
      });
    }
    this.rt.events.emit('emission', emission);
  }

  /** Reglas de calle: ¿alguien lo ha olido? */
  private judgeEmission(radius: number): void {
    const street = this.street;
    if (!street || this.state !== 'playing') return;
    const x = this.player.sprite.x;
    const witnesses = this.pedestrians.countWithin(x, radius);
    this.pedestrians.react(x, 3, this.rt.reducedMotion, radius);
    const verdict = street.resolveEmission(witnesses);
    this.fx.radius(this.player.rear, radius, verdict.clean ? '#b5e36b' : '#ff4d6d');

    if (verdict.clean) {
      this.time.delayedCall(250, () => {
        this.rt.play(cleanEmissionSound);
        this.fx.floatingScore(`¡Sin testigos! ×${formatMultiplier(verdict.multiplier)}`, x, GAME_CONFIG.groundY - 150, '#b5e36b');
      });
      return;
    }
    if (verdict.pointsPenalty > 0) {
      this.loseWitnessPoints(verdict.pointsPenalty, x);
      return;
    }
    this.rt.mission?.host.report({ type: 'POLICE_STAR_ADDED', wantedLevel: verdict.wanted });
    this.rt.play(whistleSound);
    this.time.delayedCall(200, () => this.rt.play(sirenSound));
    this.fx.siren(this.rt.reducedMotion);
    this.fx.banner('¡ALTERACIÓN DEL\nORDEN PÚBLICO!', 44, '#ff4d6d', 700);
    if (verdict.arrested) this.startArrest();
  }

  /** Pedo con testigos sin policía: cuesta puntos, pero la misión sigue. */
  private loseWitnessPoints(points: number, x: number): void {
    const change = this.rt.mission?.host.report({ type: 'CAMPAIGN_POINTS_LOST', amount: points });
    const lost = change ? -change.applied : 0;
    this.pointsLost += lost;
    this.rt.play(whistleSound);
    this.player.flash(0xff9aa8, 220);
    this.fx.banner('¡TE HAN OLIDO!', 44, '#ff4d6d', 600);
    this.time.delayedCall(250, () => {
      this.fx.floatingScore(lost > 0 ? `−${lost.toLocaleString('es-ES')} · ×1` : '¡Pillado! ×1', x, GAME_CONFIG.groundY - 150, '#ff8fa3');
    });
  }

  private recoil(px: number): void {
    this.tweens.killTweensOf(this.player);
    this.player.offsetX = 0;
    this.tweens.add({ targets: this.player, offsetX: px, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Fin por tiempo (partida normal). */
  private endSession(): void {
    this.state = 'ending';
    this.rt.context.setPauseAvailable(false);
    this.runner.releaseJump();
    this.rt.play(whistleSound);
    this.fx.banner('¡TIEMPO!', 90, '#ffd23f', 900);
    if (this.rt.mission) {
      this.time.delayedCall(1700, () => this.finishMission('completed'));
      return;
    }
    this.rt.finishSession(this.score.snapshot());
    this.time.delayedCall(1700, () => this.scene.start('results'));
  }

  /** Meta alcanzada (modo por distancia). */
  private arrive(): void {
    this.state = 'ending';
    this.braking = true;
    this.rt.context.setPauseAvailable(false);
    this.runner.releaseJump();
    this.rt.play(fanfareSound);
    this.player.showPose('strong', 1600);
    const goal = this.rt.ruleset.goal;
    const requiresPoints = goal.kind === 'distance' && goal.requiresPoints;
    const arrivalText = goal.kind === 'distance' ? goal.arrivalText : '¡META!';
    const scored = !requiresPoints || (this.rt.mission?.host.score ?? this.score.score) > 0;
    this.fx.banner(scored ? arrivalText : 'LLEGAS…\n¡PERO SIN PUNTOS!', 50, scored ? '#8bd450' : '#ff8fa3', 1300);
    this.time.delayedCall(2400, () => this.finishMission(scored ? 'completed' : 'failed', scored ? undefined : 'noPoints'));
  }

  /** Cinco estrellas: los agentes se lo llevan. */
  private startArrest(): void {
    this.state = 'arrest';
    this.rt.context.setPauseAvailable(false);
    this.runner.releaseJump();
    this.time.delayedCall(700, () => {
      this.fx.banner('¡DETENIDO!', 80, '#ff4d6d', 700);
      this.fx.siren(this.rt.reducedMotion, 6);
      this.rt.play(sirenSound);
      this.escorting = true;
      new PoliceEscort(this).run(this.player.sprite, this.rt.skin.id, this.rt.reducedMotion, () => {
        this.fx.banner('ARRESTADO POR DELITOS\nCONTRA LA DECENCIA PÚBLICA', 34, '#ffd23f', 1500);
        this.time.delayedCall(2300, () => this.finishMission('failed', 'arrested'));
      });
    });
  }

  private finishMission(status: 'completed' | 'failed', reason?: string): void {
    const mission = this.rt.mission;
    if (!mission || this.finished) return;
    this.finished = true;
    mission.host.finish({ status, reason, stats: this.missionStats() });
  }

  private missionStats(): WalkingMissionStats {
    const s = this.score.snapshot();
    const multipliers = this.rt.ruleset.itemMultipliers;
    let special = 0;
    for (const [id, count] of Object.entries(s.collected)) if ((multipliers[id] ?? 1) > 1) special += count;
    return {
      pointsEarned: s.score,
      collected: s.collected,
      specialCollected: special,
      otherCollected: s.totalCollected - special,
      emissions: s.burps + s.farts,
      cleanEmissions: this.street?.cleanEmissions ?? 0,
      witnessedEmissions: this.street?.witnessedEmissions ?? 0,
      pointsLost: this.pointsLost,
      pedestriansAffected: this.street?.pedestriansAffected ?? 0,
      bestMultiplier: this.street?.bestMultiplier ?? 1,
      wanted: this.street?.wanted ?? 0,
      maxWanted: this.street?.maxWanted ?? 0,
      stumbles: this.stumbles,
      durationSec: Math.round(this.elapsed),
    };
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
    this.gestures?.dispose();
    this.gestures = null;
    this.hint = null;
    // Al destruir el juego entero, el gestor de escenas ya no existe: no hay HUD que parar.
    if (this.scene.manager && this.scene.isActive('hud')) this.scene.stop('hud');
  }
}

function acquire<T extends { active: boolean }>(pool: T[], make: () => T): T {
  for (const item of pool) if (!item.active) return item;
  const item = make();
  pool.push(item);
  return item;
}

export function formatMultiplier(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}
