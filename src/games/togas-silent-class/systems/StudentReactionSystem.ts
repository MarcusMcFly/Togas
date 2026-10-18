import type { Random } from '../../../core/utils/Random';
import { clamp } from '../../../core/utils/math';
import {
  CLASS_REACTIONS, REACTION_CONFIG, STUDENT_REACTIONS, TRUMPET_REACTIONS,
  type ClassReactionDef, type ReactionAnim, type ReactionTuning, type StudentReactionDef,
} from '../config/reactions.config';
import type { EmissionTier } from '../config/scoring.config';
import { STUDENT_TIMINGS } from '../config/students.config';

export type StudentState = 'awake' | 'drowsy' | 'asleep' | 'startled';

export interface StudentSnapshot {
  id: string;
  state: StudentState;
  /** Ya contó como "noqueado": no vuelve a dar puntos en esta sesión. */
  knockedOut: boolean;
  distance: number;
  /** Reacción en curso a la última emisión (independiente del estado de sueño). */
  reaction: ReactionAnim | null;
}

interface Student extends StudentSnapshot {
  timer: number;
  reactionLeft: number;
}

export interface SeatPosition {
  id: string;
  x: number;
  y: number;
}

export interface CloudResult {
  /** Estudiantes que se acaban de dormir por primera vez. */
  asleep: string[];
  drowsy: string[];
}

/** Lo que ha provocado una emisión en un compañero concreto. */
export interface StudentReaction {
  studentId: string;
  reactionId: string;
  message: string;
  color: string;
  anim: ReactionAnim;
  /** Intensidad que le ha llegado (0–1). */
  intensity: number;
  /** Bonus que da (0 si no hay recompensa); nunca más de uno por compañero y emisión. */
  bonus: number;
  distance: number;
}

export interface EmissionReactions {
  students: StudentReaction[];
  /** Titular de toda la clase (o nada), con su bonus ya ajustado. */
  headline: (Omit<ClassReactionDef, 'test'> & { bonus: number }) | null;
}

export interface ReactionInput {
  kind: 'silent' | 'trumpet';
  pressure: number;
  perfect: boolean;
  /** Alcance de la nube (o del susto): con él se mide la caída por distancia. */
  reach: number;
  /** Afectados, en el orden en que les llega. Los repetidos se ignoran. */
  affected: readonly string[];
  /** Los que se acaban de dormir: la nube les llega de lleno. */
  asleep: readonly string[];
  /** Intensidad del trompetazo (1–5); 0 si fue silencioso. */
  trumpetIntensity: number;
  /** Si es `false`, las reacciones se ven pero no dan bonus. */
  rewarded: boolean;
}

/**
 * Estado individual de cada compañero. La nube no simula difusión: elige a los más
 * cercanos dentro del alcance del nivel, en orden de distancia al asiento del jugador.
 */
export class StudentReactionSystem {
  private readonly students: Student[];

  constructor(
    seats: readonly SeatPosition[],
    origin: { x: number; y: number },
    private readonly timings = STUDENT_TIMINGS,
  ) {
    this.students = seats.map((s) => ({
      id: s.id,
      state: 'awake',
      knockedOut: false,
      distance: Math.hypot(s.x - origin.x, (s.y - origin.y) * timings.depthWeight),
      timer: 0,
      reaction: null,
      reactionLeft: 0,
    }));
  }

  get all(): readonly StudentSnapshot[] {
    return this.students;
  }

  get total(): number {
    return this.students.length;
  }

  get asleepCount(): number {
    return this.students.reduce((n, s) => n + (s.knockedOut ? 1 : 0), 0);
  }

  get allAsleep(): boolean {
    return this.asleepCount === this.students.length;
  }

  stateOf(id: string): StudentState | null {
    return this.students.find((s) => s.id === id)?.state ?? null;
  }

  /** Un estudiante dormido cualquiera (para el evento del ronquido). */
  pickSleeping(rng: Random): string | null {
    const sleeping = this.students.filter((s) => s.state === 'asleep');
    return sleeping.length ? rng.pick(sleeping).id : null;
  }

  /**
   * Nube silenciosa. `knockOut = false` si el profe estaba mirando: su mirada
   * mantiene a todos alerta y solo se adormilan.
   */
  applyCloud(tier: EmissionTier, rng: Random, knockOut = true): CloudResult {
    const result: CloudResult = { asleep: [], drowsy: [] };
    const eligible = this.students
      .filter((s) => !s.knockedOut && s.distance <= tier.reach)
      .sort((a, b) => a.distance - b.distance);
    const count = knockOut ? Math.min(eligible.length, rng.int(tier.minTargets, tier.maxTargets)) : 0;
    for (let i = 0; i < count; i++) {
      const s = eligible[i];
      s.state = 'asleep';
      s.knockedOut = true;
      s.timer = 0;
      result.asleep.push(s.id);
    }
    const drowsyReach = tier.reach * this.timings.drowsyReachFactor;
    for (const s of this.students) {
      if (s.knockedOut || s.distance > drowsyReach || s.state === 'startled') continue;
      s.state = 'drowsy';
      s.timer = this.timings.drowsySec;
      result.drowsy.push(s.id);
    }
    return result;
  }

  /** Trompetazo: todos los que estén al alcance pegan un bote. Los dormidos se vuelven a dormir. */
  startle(intensity: number): string[] {
    const reach = this.timings.startleReachPerIntensity * (1 + intensity);
    const startled: string[] = [];
    for (const s of this.students) {
      if (s.distance > reach) continue;
      s.state = 'startled';
      s.timer = this.timings.startledSec;
      startled.push(s.id);
    }
    return startled;
  }

  reactionOf(id: string): ReactionAnim | null {
    return this.students.find((s) => s.id === id)?.reaction ?? null;
  }

  /**
   * Reacciones a una emisión (IMP-04): cada afectado reacciona según la intensidad que
   * le llega (presión, distancia y si se ha dormido), con variedad por pesos. Cada
   * compañero aparece como mucho una vez, así que su bonus no se puede repetir.
   */
  react(input: ReactionInput, rng: Random, config: Readonly<ReactionTuning> = REACTION_CONFIG): EmissionReactions {
    const silent = input.kind === 'silent';
    const base = silent
      ? Math.pow(clamp(input.pressure / 100, 0, 1), config.pressureExponent)
      : clamp(input.trumpetIntensity / 5, 0, 1);
    const defs = silent ? STUDENT_REACTIONS : TRUMPET_REACTIONS;
    const asleep = new Set(input.asleep);
    const seen = new Set<string>();
    const students: StudentReaction[] = [];
    for (const id of input.affected) {
      const s = this.students.find((st) => st.id === id);
      if (!s || seen.has(id)) continue;
      seen.add(id);
      const falloff = 1 - config.distanceFalloff * clamp(s.distance / Math.max(1, input.reach), 0, 1);
      const intensity = clamp(base * falloff * (asleep.has(id) ? config.asleepBoost : 1), 0, 1);
      const def = pickReaction(defs, intensity, rng);
      s.reaction = def.anim;
      s.reactionLeft = config.reactionSec;
      students.push({
        studentId: id, reactionId: def.id, message: def.message, color: def.color, anim: def.anim,
        intensity, bonus: input.rewarded ? def.bonus : 0, distance: s.distance,
      });
    }
    const context = {
      kind: input.kind, pressure: input.pressure, perfect: input.perfect,
      affected: students.length, trumpetIntensity: input.trumpetIntensity,
    };
    const def = CLASS_REACTIONS.find((c) => c.test(context));
    // Apocalipsis: los que caen lo hacen a lo grande.
    if (def?.id === 'silentApocalypse') {
      for (const r of students) {
        if (!asleep.has(r.studentId)) continue;
        r.anim = 'deepSleep';
        const s = this.students.find((st) => st.id === r.studentId);
        if (s) s.reaction = 'deepSleep';
      }
    }
    const headline = def ? { id: def.id, message: def.message, color: def.color, bonus: input.rewarded ? def.bonus : 0 } : null;
    return { students, headline };
  }

  update(dt: number): void {
    for (const s of this.students) {
      if (s.reactionLeft > 0) {
        s.reactionLeft = Math.max(0, s.reactionLeft - dt);
        if (s.reactionLeft === 0) s.reaction = null;
      }
      if (s.timer <= 0) continue;
      s.timer -= dt;
      if (s.timer > 0) continue;
      s.timer = 0;
      // Al acabar el susto o la modorra: los noqueados vuelven a dormir, el resto despierta.
      s.state = s.knockedOut ? 'asleep' : 'awake';
    }
  }
}

/** Reacción para una intensidad: sorteo por pesos entre las que la admiten. */
function pickReaction(defs: readonly StudentReactionDef[], intensity: number, rng: Random): StudentReactionDef {
  const fitting = defs.filter((d) => intensity >= d.minIntensity && intensity <= d.maxIntensity && d.weight > 0);
  if (fitting.length) return rng.weighted(fitting, (d) => d.weight);
  // Sin coincidencia (configuración con huecos): la de rango más cercano.
  const gap = (d: StudentReactionDef) => Math.max(d.minIntensity - intensity, intensity - d.maxIntensity, 0);
  return defs.reduce((best, d) => (gap(d) < gap(best) ? d : best));
}
