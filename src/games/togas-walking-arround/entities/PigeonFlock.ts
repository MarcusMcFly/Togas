import type Phaser from 'phaser';
import { ART_SCALE, PIGEON_FLY_ANIM, PIGEON_PECK_ANIM, pigeonTex } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import { DEPTH } from '../ui/theme';

interface Pigeon {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  flying: boolean;
  /** Mientras está en el suelo se mueve con la acera (coordenadas de mundo). */
  worldX: number;
  vx: number;
  vy: number;
}

/**
 * Palomas decorativas en la acera. Con emisiones de nivel 4 o más salen volando.
 * Puro decorado: no afectan al juego.
 */
export class PigeonFlock {
  private readonly pigeons: Pigeon[] = [];
  private nextSpawnAt = 900;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < 8; i++) {
      const sprite = scene.add
        .sprite(0, 0, pigeonTex(0))
        .setOrigin(0.5, 30 / 32)
        .setScale(1 / ART_SCALE)
        .setDepth(DEPTH.pigeons)
        .setVisible(false);
      this.pigeons.push({ sprite, active: false, flying: false, worldX: 0, vx: 0, vy: 0 });
    }
  }

  update(distance: number, dt: number): void {
    const width = GAME_CONFIG.view.width;
    if (distance >= this.nextSpawnAt) {
      const count = 1 + Math.floor(Math.random() * 3);
      const baseX = distance + width + 40;
      for (let i = 0; i < count; i++) this.spawn(baseX + i * 26 + Math.random() * 12);
      this.nextSpawnAt = distance + 1400 + Math.random() * 1600;
    }

    for (const p of this.pigeons) {
      if (!p.active) continue;
      if (p.flying) {
        p.sprite.x += p.vx * dt;
        p.sprite.y += p.vy * dt;
        p.vy -= 160 * dt;
        if (p.sprite.y < -40 || p.sprite.x < -60 || p.sprite.x > width + 60) this.release(p);
      } else {
        p.sprite.x = p.worldX - distance;
        if (p.sprite.x < -40) this.release(p);
      }
    }
  }

  /** Espanta a las palomas visibles. Con `extra`, aparecen más desde los lados (nivel legendario). */
  scare(originX: number, extra = 0): void {
    for (const p of this.pigeons) {
      if (p.active && !p.flying && p.sprite.x > -20 && p.sprite.x < GAME_CONFIG.view.width + 20) this.takeOff(p, originX);
    }
    for (let i = 0; i < extra; i++) {
      const p = this.pigeons.find((candidate) => !candidate.active);
      if (!p) break;
      p.active = true;
      p.sprite.setVisible(true).setPosition(originX + (Math.random() - 0.5) * 260, GAME_CONFIG.groundY - Math.random() * 30);
      this.takeOff(p, originX);
    }
  }

  private spawn(worldX: number): void {
    const p = this.pigeons.find((candidate) => !candidate.active);
    if (!p) return;
    p.active = true;
    p.flying = false;
    p.worldX = worldX;
    p.sprite.setVisible(true).setFlipX(Math.random() < 0.5).setY(GAME_CONFIG.groundY);
    p.sprite.play({ key: PIGEON_PECK_ANIM, startFrame: Math.floor(Math.random() * 3) });
  }

  private takeOff(p: Pigeon, originX: number): void {
    p.flying = true;
    const away = p.sprite.x >= originX ? 1 : -1;
    p.vx = away * (120 + Math.random() * 180);
    p.vy = -(220 + Math.random() * 160);
    p.sprite.setFlipX(away < 0);
    p.sprite.play(PIGEON_FLY_ANIM);
  }

  private release(p: Pigeon): void {
    p.active = false;
    p.flying = false;
    p.sprite.stop();
    p.sprite.setVisible(false);
  }
}
