import type Phaser from 'phaser';
import type { SkinDefinition } from '../../../core/characters/SkinDefinition';
import { paintTexture } from '../../../core/ui/phaser/canvasTexture';
import { STUDENT_SEATS, type StudentSeat } from '../config/students.config';
import { CLASSROOM, DESK, drawClassroom, drawDeskRow } from './classroom';
import { FX_CANVAS, drawDrop, drawPaper, drawPuff, drawRing, drawSpark } from './effects';
import { PROFESSOR_CANVAS, PROFESSOR_FRAMES, drawProfessor, type ProfessorFrame } from './professor';
import {
  BUTT_POSES, EXPRESSIONS, FACE_SIZE, PART_CANVAS, TORSO_POSES, drawButt, drawFace, drawLeg, drawTorso,
  type ButtPose, type Expression, type TorsoPose,
} from './seatedPlayer';
import { STUDENT_CANVAS, STUDENT_POSES, drawStudent, type StudentPose } from './student';

/** Resoluciones de dibujo (píxeles por unidad lógica). Más alto = más nítido y más memoria. */
export const RES = { background: 2, people: 1.6, fx: 2 } as const;

export const TEX = {
  background: 'cls:bg',
  puff: 'cls:fx:puff',
  ring: 'cls:fx:ring',
  spark: 'cls:fx:spark',
  paper: 'cls:fx:paper',
  drop: 'cls:fx:drop',
} as const;

export const deskRowTex = (row: number): string => `cls:desks:${row}`;
export const studentTex = (seatId: string, pose: StudentPose): string => `cls:student:${seatId}:${pose}`;
export const professorTex = (frame: ProfessorFrame): string => `cls:prof:${frame}`;
export const legTex = (skinId: string, side: -1 | 1): string => `cls:player:${skinId}:leg${side}`;
export const buttTex = (skinId: string, pose: ButtPose): string => `cls:player:${skinId}:butt:${pose}`;
export const torsoTex = (skinId: string, pose: TorsoPose): string => `cls:player:${skinId}:torso:${pose}`;
export const faceTex = (skinId: string, expression: Expression): string => `cls:face:${skinId}:${expression}`;

/** Filas de pupitres agrupadas por altura del asiento (de la del fondo a la del jugador). */
export interface DeskRow {
  index: number;
  seatY: number;
  scale: number;
  seats: StudentSeat[];
  /** Coordenada Y donde se coloca la textura de la fila. */
  textureY: number;
  textureHeight: number;
}

export function deskRows(): DeskRow[] {
  const byY = new Map<number, StudentSeat[]>();
  for (const seat of STUDENT_SEATS) byY.set(seat.y, [...(byY.get(seat.y) ?? []), seat]);
  return [...byY.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seatY, seats], index) => {
      const scale = seats[0].scale;
      const textureY = Math.floor(seatY - (DESK.topFar + 40) * scale);
      const textureHeight = Math.ceil((DESK.topFar + 40 + DESK.benchBottom + 8) * scale);
      return { index, seatY, scale, seats, textureY, textureHeight };
    });
}

/** Texturas comunes a todas las partidas. Se generan una vez por sesión, en BootScene. */
export function generateTextures(
  scene: Phaser.Scene,
  skins: readonly SkinDefinition[],
  playerSeat: { x: number; y: number },
  options: { aristocrat?: boolean } = {},
): void {
  const t = scene.textures;
  paintTexture(t, TEX.background, CLASSROOM.width, CLASSROOM.height, RES.background, drawClassroom);

  for (const row of deskRows()) {
    const playerX = row.seatY === playerSeat.y ? playerSeat.x : null;
    paintTexture(t, deskRowTex(row.index), CLASSROOM.width, row.textureHeight, RES.background, (ctx) => {
      ctx.translate(0, -row.textureY);
      drawDeskRow(ctx, row.seats, row.seatY, row.scale, playerX);
    });
  }

  const S = STUDENT_CANVAS;
  for (const seat of STUDENT_SEATS) {
    for (const pose of STUDENT_POSES) {
      paintTexture(t, studentTex(seat.id, pose), S.width, S.height, RES.people * seat.scale, (ctx) => drawStudent(ctx, seat.look, pose));
    }
  }

  const P = PROFESSOR_CANVAS;
  for (const frame of PROFESSOR_FRAMES) {
    paintTexture(t, professorTex(frame), P.width, P.height, RES.people, (ctx) => drawProfessor(ctx, frame, options.aristocrat));
  }

  paintTexture(t, TEX.puff, FX_CANVAS.puff, FX_CANVAS.puff, RES.fx, drawPuff);
  paintTexture(t, TEX.ring, FX_CANVAS.ring, FX_CANVAS.ring, RES.fx, drawRing);
  paintTexture(t, TEX.spark, FX_CANVAS.spark, FX_CANVAS.spark, RES.fx, drawSpark);
  paintTexture(t, TEX.paper, FX_CANVAS.paper, FX_CANVAS.paper, RES.fx, drawPaper);
  paintTexture(t, TEX.drop, FX_CANVAS.drop, FX_CANVAS.drop, RES.fx, drawDrop);

  for (const skin of skins) {
    for (const expression of EXPRESSIONS) {
      paintTexture(t, faceTex(skin.id, expression), FACE_SIZE, FACE_SIZE, RES.fx, (ctx) => drawFace(ctx, skin.look, expression));
    }
  }
}

/** El protagonista solo se dibuja para la skin elegida (es la textura más grande). */
export function ensurePlayerTextures(scene: Phaser.Scene, skin: SkinDefinition): void {
  const t = scene.textures;
  const { width, height } = PART_CANVAS;
  for (const side of [-1, 1] as const) paintTexture(t, legTex(skin.id, side), width, height, RES.people, (ctx) => drawLeg(ctx, skin.look, side));
  for (const pose of BUTT_POSES) paintTexture(t, buttTex(skin.id, pose), width, height, RES.people, (ctx) => drawButt(ctx, skin.look, pose));
  for (const pose of TORSO_POSES) paintTexture(t, torsoTex(skin.id, pose), width, height, RES.people, (ctx) => drawTorso(ctx, skin.look, pose));
}
