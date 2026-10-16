import type { Random } from '../../../core/utils/Random';
import type { EmissionTier } from '../config/scoring.config';
import { STUDENT_TIMINGS } from '../config/students.config';

export type StudentState = 'awake' | 'drowsy' | 'asleep' | 'startled';

export interface StudentSnapshot {
  id: string;
  state: StudentState;
  /** Ya contó como "noqueado": no vuelve a dar puntos en esta sesión. */
  knockedOut: boolean;
  distance: number;
}

interface Student extends StudentSnapshot {
  timer: number;
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

  update(dt: number): void {
    for (const s of this.students) {
      if (s.timer <= 0) continue;
      s.timer -= dt;
      if (s.timer > 0) continue;
      s.timer = 0;
      // Al acabar el susto o la modorra: los noqueados vuelven a dormir, el resto despierta.
      s.state = s.knockedOut ? 'asleep' : 'awake';
    }
  }
}
