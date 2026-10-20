import type Phaser from 'phaser';
import { PERSON_CANVAS } from '../art/pedestrian';
import { ART_SCALE, pedFaceTex, pedFleeAnim, pedTex, pedWalkAnim } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import {
  PEDESTRIAN_CONFIG, PEDESTRIAN_LOOKS, type PedestrianLook, type ReactionType,
} from '../config/pedestrians.config';
import { FORWARD_VIEW, type ViewDirection } from '../systems/ViewDirection';
import { DEPTH, addText } from '../ui/theme';

type State = 'walk' | 'react' | 'flee';

interface Pedestrian {
  look: PedestrianLook;
  sprite: Phaser.GameObjects.Sprite;
  face: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  active: boolean;
  /** Cambia en cada aparición: invalida reacciones programadas para un viandante ya reciclado. */
  serial: number;
  state: State;
  worldX: number;
  walkSpeed: number;
  /** Sentido del paseo en el mundo: -1 hacia el jugador, +1 en su mismo sentido. */
  direction: number;
  reactUntil: number;
  /** Sentido de la huida en el mundo (como `direction`). */
  fleeDirection: number;
}

/** Altura aproximada del dibujo (de los pies a lo alto de la cabeza), en unidades lógicas. */
const PERSON_HEIGHT = 112;
const FACE_SCALE = 1.25 / ART_SCALE;

export interface CrowdOptions {
  /** Pasean en ambos sentidos (si no, todos van hacia el jugador). */
  bothWays: boolean;
  view?: ViewDirection;
}

/**
 * Viandantes que pasean por la acera y reaccionan a los pedos con sorpresa,
 * cabreo (ambos con la cara ampliada en una viñeta) o saliendo corriendo.
 * En la partida normal son decorado; las reglas de calle los cuentan como testigos.
 */
export class PedestrianCrowd {
  private readonly people: Pedestrian[] = [];
  private nextSpawnAt: number = PEDESTRIAN_CONFIG.spawnEvery[0];
  private readonly view: ViewDirection;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: CrowdOptions = { bothWays: false },
  ) {
    this.view = options.view ?? FORWARD_VIEW;
    for (let i = 0; i < PEDESTRIAN_CONFIG.maxActive; i++) {
      const look = PEDESTRIAN_LOOKS[0];
      const sprite = scene.add
        .sprite(0, GAME_CONFIG.groundY, pedTex(look.id, 'walk0'))
        .setOrigin(PERSON_CANVAS.feetX / PERSON_CANVAS.width, PERSON_CANVAS.feetY / PERSON_CANVAS.height)
        .setDepth(DEPTH.pigeons)
        .setVisible(false);
      const face = scene.add.image(0, 0, pedFaceTex(look.id, 'surprised')).setDepth(DEPTH.fx - 2).setVisible(false);
      const label = addText(scene, 0, 0, '', 18).setDepth(DEPTH.fx - 1).setVisible(false);
      this.people.push({
        look, sprite, face, label, active: false, serial: 0, state: 'walk',
        worldX: 0, walkSpeed: 0, direction: -1, reactUntil: 0, fleeDirection: 1,
      });
    }
  }

  update(distance: number, dt: number): void {
    const now = this.scene.time.now;
    const width = GAME_CONFIG.view.width;
    if (distance >= this.nextSpawnAt) {
      this.spawn(distance + width + 60);
      const [min, max] = PEDESTRIAN_CONFIG.spawnEvery;
      this.nextSpawnAt = distance + min + Math.random() * (max - min);
    }

    for (const p of this.people) {
      if (!p.active) continue;
      if (p.state === 'walk') p.worldX += p.direction * p.walkSpeed * dt;
      else if (p.state === 'flee') p.worldX += p.fleeDirection * PEDESTRIAN_CONFIG.fleeSpeed * dt;
      else if (now >= p.reactUntil) this.walk(p);

      const x = p.worldX - distance;
      const screenX = this.view.x(x);
      p.sprite.x = screenX;
      const headTop = GAME_CONFIG.groundY - PERSON_HEIGHT * p.look.scale;
      p.face.setPosition(screenX, headTop - 44);
      p.label.setPosition(screenX, p.face.visible ? headTop - 96 : headTop - 18);

      if (x < -80 || x > width + 160) this.release(p);
    }
  }

  /** Viandantes visibles a menos de `radius` píxeles de `originX` (pantalla). */
  countWithin(originX: number, radius: number): number {
    let count = 0;
    for (const p of this.people) {
      if (p.active && Math.abs(p.sprite.x - originX) <= radius) count++;
    }
    return count;
  }

  /**
   * Un pedo de nivel `tier` en `originX` (pantalla): reaccionan los que estén dentro del
   * radio. Por defecto el radio crece con el nivel; las reglas de calle pasan el suyo.
   */
  react(originX: number, tier: number, reducedMotion: boolean, radiusOverride?: number): void {
    const { base, perTier } = PEDESTRIAN_CONFIG.reactionRadius;
    const radius = radiusOverride ?? base + perTier * tier;
    const weights = PEDESTRIAN_CONFIG.reactionWeights[Math.min(Math.max(tier, 1), 5) - 1];
    for (const p of this.people) {
      if (!p.active || p.state === 'flee') continue;
      const dx = p.sprite.x - originX;
      if (Math.abs(dx) > radius) continue;
      const reaction = pickReaction(weights);
      const serial = p.serial;
      // La "onda" llega antes a quien está más cerca.
      this.scene.time.delayedCall(Math.abs(dx) * PEDESTRIAN_CONFIG.delayPerPixelMs, () => {
        if (p.active && p.serial === serial && p.state !== 'flee') this.startReaction(p, reaction, dx, reducedMotion);
      });
    }
  }

  private spawn(worldX: number): void {
    const p = this.people.find((candidate) => !candidate.active);
    if (!p) return;
    const look = PEDESTRIAN_LOOKS[Math.floor(Math.random() * PEDESTRIAN_LOOKS.length)];
    const [min, max] = PEDESTRIAN_CONFIG.walkSpeed;
    p.look = look;
    p.active = true;
    p.serial++;
    p.worldX = worldX;
    p.walkSpeed = min + Math.random() * (max - min);
    p.direction = this.options.bothWays && Math.random() < 0.45 ? 1 : -1;
    p.sprite.setScale(look.scale / ART_SCALE).setVisible(true).setAngle(0).setY(GAME_CONFIG.groundY);
    this.walk(p);
  }

  private walk(p: Pedestrian): void {
    p.state = 'walk';
    this.hideBubble(p);
    // Dibujados mirando a la derecha: se voltean si en pantalla pasean hacia la izquierda.
    p.sprite.setFlipX(this.view.dir(p.direction) < 0).setAngle(0);
    p.sprite.play(pedWalkAnim(p.look.id), true);
  }

  private startReaction(p: Pedestrian, reaction: ReactionType, dx: number, reducedMotion: boolean): void {
    const words = PEDESTRIAN_CONFIG.words[reaction];
    const word = words[Math.floor(Math.random() * words.length)];
    const scene = this.scene;
    scene.tweens.killTweensOf([p.sprite, p.face, p.label]);
    p.sprite.setAngle(0).setY(GAME_CONFIG.groundY);

    if (reaction === 'flee') {
      p.state = 'flee';
      this.hideBubble(p);
      // `dx` es de pantalla: huye alejándose del jugador tal y como se ve.
      p.fleeDirection = this.view.dir(dx >= 0 ? 1 : -1);
      p.sprite.setFlipX(this.view.dir(p.fleeDirection) < 0);
      p.sprite.play(pedFleeAnim(p.look.id), true);
      // Respingo antes de salir corriendo.
      scene.tweens.add({ targets: p.sprite, y: GAME_CONFIG.groundY - 14, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      this.showLabel(p, word, '#9ad7ff');
      return;
    }

    p.state = 'react';
    p.reactUntil = scene.time.now + PEDESTRIAN_CONFIG.reactionMs;
    const expression = reaction === 'surprise' ? 'surprised' : 'angry';
    // Se giran hacia el culpable.
    const facePlayer = dx > 0;
    p.sprite.stop();
    p.sprite.setTexture(pedTex(p.look.id, expression)).setFlipX(facePlayer);

    p.face.setTexture(pedFaceTex(p.look.id, expression)).setFlipX(facePlayer).setVisible(true).setAlpha(1).setScale(0).setAngle(0);
    scene.tweens.add({ targets: p.face, scale: FACE_SCALE, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: p.face, scale: 0, alpha: 0, delay: PEDESTRIAN_CONFIG.reactionMs - 280, duration: 220, ease: 'Quad.easeIn' });

    if (reaction === 'anger') {
      if (!reducedMotion) {
        scene.tweens.add({ targets: p.face, angle: { from: -9, to: 9 }, duration: 70, yoyo: true, repeat: 6 });
        scene.tweens.add({ targets: p.sprite, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 4, onComplete: () => p.sprite.setAngle(0) });
      }
      this.showLabel(p, word, '#ff6b6b');
    } else {
      scene.tweens.add({ targets: p.sprite, y: GAME_CONFIG.groundY - 10, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
      this.showLabel(p, word, '#ffd23f');
    }
  }

  private showLabel(p: Pedestrian, text: string, color: string): void {
    p.label.setText(text).setColor(color).setVisible(true).setAlpha(1).setScale(0.4);
    this.scene.tweens.add({ targets: p.label, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: p.label, alpha: 0, delay: 1100, duration: 350, onComplete: () => p.label.setVisible(false) });
  }

  private hideBubble(p: Pedestrian): void {
    this.scene.tweens.killTweensOf(p.face);
    p.face.setVisible(false);
  }

  private release(p: Pedestrian): void {
    p.active = false;
    this.scene.tweens.killTweensOf([p.sprite, p.face, p.label]);
    p.sprite.stop();
    p.sprite.setVisible(false);
    p.face.setVisible(false);
    p.label.setVisible(false);
  }
}

function pickReaction(weights: Readonly<Record<ReactionType, number>>): ReactionType {
  const entries = Object.entries(weights) as Array<[ReactionType, number]>;
  let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return entries[entries.length - 1][0];
}
