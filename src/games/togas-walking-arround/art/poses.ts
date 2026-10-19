import { pose, type Pose } from './character';

/**
 * Animaciones del personaje (contrato de skin de la spec). Cada skin las genera
 * a partir de su `look`, así que añadir una skin no exige dibujar nada a mano.
 */
export const RUN_FRAMES = 6;
export const IDLE_FRAMES = 2;

export type SinglePose = 'jump' | 'fall' | 'land' | 'collect' | 'burp' | 'fart' | 'strong' | 'hit' | 'roll';

export function runPose(frame: number): Pose {
  const phase = (frame / RUN_FRAMES) * Math.PI * 2;
  return pose({
    legSwing: Math.sin(phase),
    legLift: 1,
    armSwing: -Math.sin(phase) * 0.8,
    bob: -Math.abs(Math.cos(phase)) * 3,
    lean: 0.1,
  });
}

export function idlePose(frame: number): Pose {
  return pose({ armSwing: 0.1, bob: frame === 0 ? 0 : 1.5 });
}

export const SINGLE_POSES: Record<SinglePose, Pose> = {
  jump: pose({ legSwing: 0.4, tuck: 0.8, armsUp: 0.7, mouth: 'o', eyes: 'wide', lean: 0.05 }),
  fall: pose({ legSwing: -0.2, tuck: 0.3, armsUp: 0.35, mouth: 'open' }),
  land: pose({ crouch: 8, legSwing: 0.15, armSwing: 0.3, mouth: 'grin' }),
  collect: pose({ legSwing: 0.5, legLift: 1, armSwing: -0.6, mouth: 'grin', eyes: 'happy', lean: 0.08 }),
  burp: pose({ lean: -0.2, armSwing: -0.5, mouth: 'open', eyes: 'closed', cheeks: true }),
  fart: pose({ lean: 0.35, crouch: 6, legSwing: 0.2, mouth: 'o', eyes: 'closed' }),
  strong: pose({ armsUp: 1, crouch: 4, lean: -0.05, mouth: 'open', eyes: 'wide', cheeks: true }),
  hit: pose({ crouch: 4, lean: -0.15, armSwing: 0.7, mouth: 'grimace', eyes: 'wide' }),
  // Hecho una bola para pasar por debajo de los obstáculos.
  roll: pose({ crouch: 32, tuck: 0.25, lean: 1.1, armSwing: 0.9, mouth: 'o', eyes: 'closed' }),
};
