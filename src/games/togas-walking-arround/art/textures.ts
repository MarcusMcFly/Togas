import Phaser from 'phaser';
import { COLLECTIBLES, OBSTACLES } from '../config/collectibles.config';
import type { SkinDefinition } from '../../../core/characters/CharacterRegistry';
import { CHARACTER_CANVAS, drawCharacter, drawCharacterHead } from './character';
import {
  CITY_LAYERS, drawBuildings, drawClouds, drawPigeon, drawSky, drawSkyline, drawStreet,
} from './city';
import { FX_CANVAS, drawBubble, drawGlow, drawPuff, drawRing, drawShadow, drawSpark } from './effects';
import { ITEM_CANVAS, OBSTACLE_CANVAS, drawCollectible, drawObstacle } from './items';
import {
  ANGRY_POSE, FACE_CANVAS, FLEE_FRAMES, PERSON_CANVAS, SURPRISED_POSE, WALK_FRAMES,
  drawFaceBubble, drawPerson, fleePose, walkPose,
} from './pedestrian';
import { PEDESTRIAN_LOOKS } from '../config/pedestrians.config';
import { IDLE_FRAMES, RUN_FRAMES, SINGLE_POSES, idlePose, runPose } from './poses';

/**
 * Las texturas se dibujan al doble de resolución y se muestran a escala 1/ART_SCALE:
 * así se ven nítidas en pantallas grandes y de alta densidad.
 */
export const ART_SCALE = 2;

export const TEX = {
  sky: 'city:sky',
  clouds: 'city:clouds',
  skyline: 'city:skyline',
  buildings: 'city:buildings',
  street: 'city:street',
  puff: 'fx:puff',
  ring: 'fx:ring',
  spark: 'fx:spark',
  bubble: 'fx:bubble',
  glow: 'fx:glow',
  shadow: 'fx:shadow',
} as const;

export const charTex = (skinId: string, pose: string): string => `char:${skinId}:${pose}`;
export const headTex = (skinId: string): string => `head:${skinId}`;
export const itemTex = (id: string): string => `item:${id}`;
export const pigeonTex = (frame: number): string => `pigeon:${frame}`;
export const runAnim = (skinId: string): string => `anim:${skinId}:run`;
export const idleAnim = (skinId: string): string => `anim:${skinId}:idle`;
export const pedTex = (lookId: string, pose: string): string => `ped:${lookId}:${pose}`;
export const pedFaceTex = (lookId: string, expression: string): string => `pedface:${lookId}:${expression}`;
export const pedWalkAnim = (lookId: string): string => `anim:ped:${lookId}:walk`;
export const pedFleeAnim = (lookId: string): string => `anim:ped:${lookId}:flee`;
export const PIGEON_FLY_ANIM = 'anim:pigeon:fly';
export const PIGEON_PECK_ANIM = 'anim:pigeon:peck';
export const HEAD_ICON_SIZE = 56;

function paint(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (textures.exists(key)) return;
  const texture = textures.createCanvas(key, Math.ceil(width * ART_SCALE), Math.ceil(height * ART_SCALE));
  if (!texture) throw new Error(`No se pudo crear la textura ${key}`);
  const ctx = texture.getContext();
  ctx.save();
  ctx.scale(ART_SCALE, ART_SCALE);
  draw(ctx);
  ctx.restore();
  texture.refresh();
}

/** Genera todas las texturas del juego. Se llama una vez por sesión, en BootScene. */
export function generateTextures(scene: Phaser.Scene, skins: readonly SkinDefinition[]): void {
  const t = scene.textures;
  const L = CITY_LAYERS;

  paint(t, TEX.sky, L.sky.width, L.sky.height, drawSky);
  paint(t, TEX.clouds, L.clouds.width, L.clouds.height, drawClouds);
  paint(t, TEX.skyline, L.skyline.width, L.skyline.height, drawSkyline);
  paint(t, TEX.buildings, L.buildings.width, L.buildings.height, drawBuildings);
  paint(t, TEX.street, L.street.width, L.street.height, drawStreet);

  paint(t, TEX.puff, FX_CANVAS.puff, FX_CANVAS.puff, drawPuff);
  paint(t, TEX.ring, FX_CANVAS.ring, FX_CANVAS.ring, drawRing);
  paint(t, TEX.spark, FX_CANVAS.spark, FX_CANVAS.spark, drawSpark);
  paint(t, TEX.bubble, FX_CANVAS.bubble, FX_CANVAS.bubble, drawBubble);
  paint(t, TEX.glow, FX_CANVAS.glow, FX_CANVAS.glow, drawGlow);
  paint(t, TEX.shadow, FX_CANVAS.shadow.width, FX_CANVAS.shadow.height, drawShadow);

  for (const item of COLLECTIBLES) {
    paint(t, itemTex(item.id), ITEM_CANVAS.width, ITEM_CANVAS.height, (ctx) => drawCollectible(ctx, item.id));
  }
  for (const obstacle of OBSTACLES) {
    paint(t, itemTex(obstacle.id), OBSTACLE_CANVAS.width, OBSTACLE_CANVAS.height, (ctx) => drawObstacle(ctx, obstacle.id));
  }
  for (let frame = 0; frame < 4; frame++) paint(t, pigeonTex(frame), 40, 32, (ctx) => drawPigeon(ctx, frame));

  const P = PERSON_CANVAS;
  for (const look of PEDESTRIAN_LOOKS) {
    for (let f = 0; f < WALK_FRAMES; f++) paint(t, pedTex(look.id, `walk${f}`), P.width, P.height, (ctx) => drawPerson(ctx, look, walkPose(f)));
    for (let f = 0; f < FLEE_FRAMES; f++) paint(t, pedTex(look.id, `flee${f}`), P.width, P.height, (ctx) => drawPerson(ctx, look, fleePose(f)));
    paint(t, pedTex(look.id, 'surprised'), P.width, P.height, (ctx) => drawPerson(ctx, look, SURPRISED_POSE));
    paint(t, pedTex(look.id, 'angry'), P.width, P.height, (ctx) => drawPerson(ctx, look, ANGRY_POSE));
    for (const expression of ['surprised', 'angry'] as const) {
      paint(t, pedFaceTex(look.id, expression), FACE_CANVAS, FACE_CANVAS, (ctx) => drawFaceBubble(ctx, look, expression));
    }
  }

  const { width, height } = CHARACTER_CANVAS;
  for (const skin of skins) {
    for (let f = 0; f < RUN_FRAMES; f++) paint(t, charTex(skin.id, `run${f}`), width, height, (ctx) => drawCharacter(ctx, skin.look, runPose(f)));
    for (let f = 0; f < IDLE_FRAMES; f++) paint(t, charTex(skin.id, `idle${f}`), width, height, (ctx) => drawCharacter(ctx, skin.look, idlePose(f)));
    for (const [name, p] of Object.entries(SINGLE_POSES)) {
      paint(t, charTex(skin.id, name), width, height, (ctx) => drawCharacter(ctx, skin.look, p));
    }
    paint(t, headTex(skin.id), HEAD_ICON_SIZE, HEAD_ICON_SIZE, (ctx) => drawCharacterHead(ctx, skin.look, HEAD_ICON_SIZE / 2, HEAD_ICON_SIZE / 2 + 2, 1.3));
  }
}

export function createAnimations(scene: Phaser.Scene, skins: readonly SkinDefinition[]): void {
  const anims = scene.anims;
  for (const skin of skins) {
    if (!anims.exists(runAnim(skin.id))) {
      anims.create({
        key: runAnim(skin.id),
        frames: Array.from({ length: RUN_FRAMES }, (_, f) => ({ key: charTex(skin.id, `run${f}`) })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!anims.exists(idleAnim(skin.id))) {
      anims.create({
        key: idleAnim(skin.id),
        frames: Array.from({ length: IDLE_FRAMES }, (_, f) => ({ key: charTex(skin.id, `idle${f}`) })),
        frameRate: 3,
        repeat: -1,
      });
    }
  }
  for (const look of PEDESTRIAN_LOOKS) {
    if (!anims.exists(pedWalkAnim(look.id))) {
      anims.create({
        key: pedWalkAnim(look.id),
        frames: Array.from({ length: WALK_FRAMES }, (_, f) => ({ key: pedTex(look.id, `walk${f}`) })),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!anims.exists(pedFleeAnim(look.id))) {
      anims.create({
        key: pedFleeAnim(look.id),
        frames: Array.from({ length: FLEE_FRAMES }, (_, f) => ({ key: pedTex(look.id, `flee${f}`) })),
        frameRate: 12,
        repeat: -1,
      });
    }
  }
  if (!anims.exists(PIGEON_FLY_ANIM)) {
    anims.create({ key: PIGEON_FLY_ANIM, frames: [{ key: pigeonTex(2) }, { key: pigeonTex(3) }], frameRate: 12, repeat: -1 });
  }
  if (!anims.exists(PIGEON_PECK_ANIM)) {
    anims.create({
      key: PIGEON_PECK_ANIM,
      frames: [{ key: pigeonTex(0) }, { key: pigeonTex(1) }, { key: pigeonTex(0) }],
      frameRate: 4,
      repeat: -1,
      repeatDelay: 600,
    });
  }
}
