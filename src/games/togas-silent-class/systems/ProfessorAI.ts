import type { Random } from '../../../core/utils/Random';
import { lerp } from '../../../core/utils/math';
import type { PhaseDifficulty } from '../config/game.config';
import {
  ATTENTION_BY_STATE, PROFESSOR_CONFIG, type AttentionLevel, type ProfessorStateId, type RandomEventKind,
} from '../config/professor.config';

export type ProfessorParams = typeof PROFESSOR_CONFIG;
export type ProfessorTiming = Pick<PhaseDifficulty, 'safeWindow' | 'facingWindow' | 'watchWeight' | 'eventChance'>;

/** `auto` = juego normal. Los otros dos fijan al profe para el tutorial. */
export type ProfessorScript = 'auto' | 'faceClass' | 'faceBoard';

export interface ProfessorListener {
  stateChanged(state: ProfessorStateId, attention: AttentionLevel, targetSeatId: string | null): void;
  randomEvent(kind: RandomEventKind, seatId: string | null): void;
}

export interface ProfessorOptions {
  /** Perk "Apuntes del Profe": aviso más largo antes de girarse. */
  notesPerk: boolean;
  /** Devuelve un estudiante dormido (para el evento del ronquido) o `null`. */
  sleepingSeat: () => string | null;
}

type FacingState = 'explaining' | 'watching' | 'investigating';
const SAFE_STATES: ReadonlySet<ProfessorStateId> = new Set(['writing', 'reading', 'chalkDrop', 'erasing']);

/**
 * Máquina de estados del profesor. Siempre avisa antes de girarse
 * (pizarra → aviso → giro → mira a la clase → giro → pizarra) y nunca mira
 * a la clase tanto tiempo como para que llegar a presión 100 sea inevitable (GAME-014).
 */
export class ProfessorAI {
  private current: ProfessorStateId = 'writing';
  private elapsed = 0;
  private duration = 0;
  private nextFacing: FacingState = 'explaining';
  private target: string | null = null;
  private silenceLeft = 0;
  private heightenedLeft = 0;
  private afterInvestigation = false;
  private timing: ProfessorTiming;
  script: ProfessorScript = 'auto';

  constructor(
    private readonly rng: Random,
    private readonly options: ProfessorOptions,
    private readonly listener: ProfessorListener,
    initialTiming: ProfessorTiming,
    private readonly params: ProfessorParams = PROFESSOR_CONFIG,
  ) {
    this.timing = initialTiming;
    this.duration = this.safeDuration();
  }

  get state(): ProfessorStateId {
    return this.current;
  }

  get attention(): AttentionLevel {
    return ATTENTION_BY_STATE[this.current];
  }

  get targetSeatId(): string | null {
    return this.target;
  }

  /** Progreso del estado actual (0–1), para animaciones y la barra de aviso. */
  get progress(): number {
    return this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
  }

  /** 0 = de espaldas, 1 = mirando a la clase. */
  get facing(): number {
    switch (this.current) {
      case 'turning':
        return this.progress;
      case 'turningBack':
        return 1 - this.progress;
      case 'explaining':
      case 'watching':
      case 'investigating':
        return 1;
      default:
        return 0;
    }
  }

  get isSilent(): boolean {
    return this.silenceLeft > 0;
  }

  get isHeightened(): boolean {
    return this.heightenedLeft > 0;
  }

  /** Probabilidad de notar una liberación silenciosa ahora mismo. */
  detectionChance(): number {
    const d = this.params.detection;
    const attention = this.attention;
    if (attention === 'turning') return lerp(d.turning[0], d.turning[1], this.facing);
    return d[attention];
  }

  update(dt: number, timing: ProfessorTiming): void {
    this.timing = timing;
    this.silenceLeft = Math.max(0, this.silenceLeft - dt);
    this.heightenedLeft = Math.max(0, this.heightenedLeft - dt);
    this.elapsed += dt;
    // Un bucle por si dt es grande: nunca se salta un estado sin emitirlo.
    let guard = 0;
    while (this.elapsed >= this.duration && guard++ < 8) {
      const overflow = this.elapsed - this.duration;
      if (!this.advance()) {
        this.elapsed = this.duration;
        break;
      }
      this.elapsed = overflow;
    }
  }

  /** Tras un ruido fuerte: deja lo que esté haciendo y se gira hacia el culpable. */
  investigate(seatId: string | null): void {
    this.nextFacing = 'investigating';
    this.target = seatId;
    if (this.current === 'investigating') {
      this.elapsed = 0;
      return;
    }
    if (this.current === 'turning') return; // Ya se está girando: acabará investigando.
    if (this.facing >= 1) {
      this.enter('investigating', this.params.investigateSec);
      return;
    }
    // Giro rápido: ya no hay sorpresa que avisar, el ruido lo ha delatado todo.
    this.enter('turning', this.params.turnSec * 0.6);
  }

  /** Tras el segundo aviso: durante un rato vigila más a menudo. */
  heighten(): void {
    this.heightenedLeft = this.params.heightenedSec;
  }

  /** Para el tutorial: obliga a mirar a la clase o a la pizarra. */
  setScript(script: ProfessorScript): void {
    this.script = script;
    if (script === 'faceClass' && SAFE_STATES.has(this.current)) this.startWarning('explaining');
    if (script === 'faceBoard' && this.facing >= 1) this.enter('turningBack', this.params.turnSec);
  }

  /** Devuelve `false` si el guion obliga a quedarse en el estado actual. */
  private advance(): boolean {
    switch (this.current) {
      case 'writing':
      case 'reading':
      case 'chalkDrop':
      case 'erasing':
        if (this.script === 'faceBoard') return false;
        if (this.current !== 'chalkDrop' && this.current !== 'erasing' && this.tryRandomEvent()) return true;
        this.startWarning(this.script === 'faceClass' ? 'explaining' : this.pickFacing());
        return true;
      case 'warning':
        this.enter('turning', this.params.turnSec);
        return true;
      case 'turning':
        this.enter(this.nextFacing, this.facingDuration(this.nextFacing));
        return true;
      case 'explaining':
      case 'watching':
      case 'investigating':
        if (this.script === 'faceClass') return false;
        this.afterInvestigation = this.current === 'investigating';
        this.enter('turningBack', this.params.turnSec);
        return true;
      case 'turningBack':
        this.target = null;
        this.enterSafe();
        return true;
    }
  }

  private startWarning(next: FacingState): void {
    this.nextFacing = next;
    const extra = this.options.notesPerk ? this.params.notesPerkExtraSec : 0;
    this.enter('warning', this.params.warningSec + extra);
  }

  private enterSafe(): void {
    const state = this.rng.chance(this.params.readingChance) ? 'reading' : 'writing';
    this.enter(state, this.safeDuration());
  }

  private tryRandomEvent(): boolean {
    if (this.script !== 'auto' || !this.rng.chance(this.timing.eventChance)) return false;
    const weights = this.params.events.weights;
    const kinds = (Object.keys(weights) as RandomEventKind[]).filter((k) => k !== 'snore' || this.options.sleepingSeat() !== null);
    const kind = this.rng.weighted(kinds, (k) => weights[k]);
    const ev = this.params.events;
    switch (kind) {
      case 'chalkDrop':
        this.listener.randomEvent(kind, null);
        this.enter('chalkDrop', ev.chalkDropSec);
        return true;
      case 'erasing':
        this.listener.randomEvent(kind, null);
        this.enter('erasing', ev.erasingSec);
        return true;
      case 'silence':
        // Deja de hablar, pero sigue de espaldas: la tensión sube, la ventana sigue abierta.
        this.silenceLeft = ev.silenceSec;
        this.listener.randomEvent(kind, null);
        this.enter('writing', Math.max(this.params.minSafeSec, ev.silenceSec * 0.6));
        return true;
      case 'snore': {
        const seat = this.options.sleepingSeat();
        this.listener.randomEvent(kind, seat);
        this.target = seat;
        this.startWarning('investigating');
        return true;
      }
    }
  }

  private pickFacing(): FacingState {
    return this.rng.chance(this.timing.watchWeight) ? 'watching' : 'explaining';
  }

  private safeDuration(): number {
    const [min, max] = this.timing.safeWindow;
    let duration = this.rng.range(min, max);
    if (this.isHeightened) duration *= this.params.heightenedSafeFactor;
    duration = Math.max(this.params.minSafeSec, duration);
    if (this.afterInvestigation) {
      duration = Math.max(this.params.minSafeAfterInvestigationSec, duration);
      this.afterInvestigation = false;
    }
    return duration;
  }

  private facingDuration(state: FacingState): number {
    if (state === 'investigating') return this.params.investigateSec;
    const [min, max] = this.timing.facingWindow;
    return Math.min(this.params.maxFacingSec, this.rng.range(min, max));
  }

  private enter(state: ProfessorStateId, duration: number): void {
    this.current = state;
    this.duration = duration;
    this.elapsed = 0;
    if (state === 'explaining' || state === 'watching') this.target = null;
    this.listener.stateChanged(state, this.attention, this.target);
  }
}
