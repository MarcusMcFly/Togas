import Phaser from 'phaser';
import type { Expression } from '../art/seatedPlayer';
import { ensurePlayerTextures, deskRows } from '../art/textures';
import {
  VARIANTS_PER_SOUND, embarrassedSound, silentFartSound, strainSound, trumpetFartSound, victorySound,
} from '../audio/classSounds';
import {
  bellSound, chalkDropSound, chalkSound, countdownBeep, eraseSound, fanfareSound, footstepsSound, gaspSound, goBeep,
  heartbeatSound, mumbleSound, silenceCueSound, slamSound, snoreSound, stableSound, tickSound, warningBlip,
} from '../audio/sfx';
import { BALANCE_CONFIG } from '../config/balance.config';
import { GAME_CONFIG } from '../config/game.config';
import { PRESSURE_CONFIG } from '../config/pressure.config';
import { PROFESSOR_DIALOGUE } from '../config/professor.config';
import { REACTION_CONFIG } from '../config/reactions.config';
import { EMISSION_TIERS, SUCCESS_LINES, TRUMPET_VARIANTS } from '../config/scoring.config';
import { STUDENT_SEATS } from '../config/students.config';
import { Classroom } from '../entities/Classroom';
import { Professor } from '../entities/Professor';
import { SeatedPlayer } from '../entities/SeatedPlayer';
import { Student } from '../entities/Student';
import { ClassroomFx } from '../fx/ClassroomFx';
import { BalanceTouchController } from '../input/BalanceTouchController';
import type { SilentClassRuntime } from '../runtime';
import { ClassroomSimulation, PLAYER_TARGET, type ReleaseResult } from '../systems/ClassroomSimulation';
import type { ClassroomView } from '../ui/view';
import type { ClassroomHUD, TutorialCard } from './ClassroomHUD';

type Mode = 'play' | 'tutorial';
type Phase = 'intro' | 'playing' | 'ending';
type TutorialStep = 'hold' | 'balance' | 'wait' | 'release' | 'risk' | 'done';

const TUTORIAL_TEXT: Record<Exclude<TutorialStep, 'done'>, TutorialCard> = {
  hold: {
    step: 'PASO 1 DE 4',
    title: 'Aprieta y aguanta',
    body: 'Mantén el dedo pulsado en cualquier parte (o la barra espaciadora). No lo levantes todavía.',
  },
  balance: {
    step: 'PASO 2 DE 4',
    title: 'Centra las burbujas',
    body: 'Sin soltar, arrastra el dedo (o usa las flechas) hasta que LAS DOS burbujas de abajo estén en el centro.',
  },
  wait: {
    step: 'PASO 3 DE 4',
    title: 'Espera tu momento',
    body: 'Sigue apretando y centrado. Suelta solo cuando el profe se gire hacia la pizarra.',
  },
  release: {
    step: 'PASO 4 DE 4',
    title: '¡Ahora, suelta!',
    body: 'El profe no mira y estás centrado: levanta el dedo y nadie se enterará.',
  },
  risk: {
    step: '¡TUTORIAL SUPERADO!',
    title: 'Ojo en clase',
    body: 'Si sueltas descentrado o con el profe mirando, toda la clase lo oirá.\n\nToca para empezar la clase.',
  },
};

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * La clase. Pasa la entrada a `ClassroomSimulation`, dibuja su estado y convierte
 * sus eventos en sonidos, efectos y textos. Nada de reglas aquí.
 */
export class ClassroomScene extends Phaser.Scene {
  private mode: Mode = 'play';
  private phase: Phase = 'intro';
  private sim!: ClassroomSimulation;
  private controller: BalanceTouchController | null = null;
  private hud!: ClassroomHUD;
  private classroom!: Classroom;
  private professor!: Professor;
  private player!: SeatedPlayer;
  private students = new Map<string, Student>();
  private fx!: ClassroomFx;
  private view!: ClassroomView;
  private unsubscribers: Array<() => void> = [];
  private expressionOverride: { expression: Expression; until: number } | null = null;
  private lastStudentId: string | null = null;
  private cloudColor = 0x8bd450;
  private timers = { tick: 0, heartbeat: 0, mumble: 0, strain: 0, lecture: 0 };
  private soundVariant = 0;
  private tutorialStep: TutorialStep = 'done';
  private slowFrames = 0;

  constructor(private readonly rt: SilentClassRuntime) {
    super('classroom');
  }

  create(data: { mode?: Mode }): void {
    this.mode = data.mode ?? 'play';
    this.phase = 'intro';
    this.students = new Map();
    this.unsubscribers = [];
    this.expressionOverride = null;
    this.lastStudentId = null;
    this.timers = { tick: 0, heartbeat: 0, mumble: 1500, strain: 0, lecture: 2000 };
    this.slowFrames = 0;
    const skin = this.rt.skin;
    const tutorial = this.mode === 'tutorial';
    // La transferencia de Campus Run (si la hay) se gasta al empezar la clase de verdad.
    if (!tutorial) this.rt.beginClass();

    this.sim = new ClassroomSimulation({
      seed: Date.now() >>> 0,
      perk: tutorial ? null : this.rt.perk,
      forgiving: this.rt.preferences.forgiving,
      tutorial,
    });

    ensurePlayerTextures(this, skin);
    this.classroom = new Classroom(this);
    this.professor = new Professor(this);
    const rows = deskRows();
    for (const seat of STUDENT_SEATS) {
      const row = rows.findIndex((r) => r.seatY === seat.y);
      this.students.set(seat.id, new Student(this, seat, row));
    }
    this.player = new SeatedPlayer(this, skin, GAME_CONFIG.playerSeat.x, GAME_CONFIG.playerSeat.y);
    this.fx = new ClassroomFx(this);

    this.view = {
      mode: this.mode, skinId: skin.id, expression: 'calm', score: 0, timeLeft: GAME_CONFIG.session.durationSec,
      streak: 0, multiplier: 1, asleep: 0, totalStudents: STUDENT_SEATS.length,
      strikesLeft: GAME_CONFIG.session.maxStrikes, maxStrikes: GAME_CONFIG.session.maxStrikes,
      pressure: 0, horizontal: 0, vertical: 0, zoneH: 'settling', zoneV: 'settling', holding: false, ready: false, blocked: 'notHolding', stability: 0,
      attention: 'away', attentionProgress: 0, attentionEmphasis: this.rt.perk === 'professorNotes' && !tutorial,
      silence: false, joystick: { active: false, originX: 0, originY: 0, thumbX: 0, thumbY: 0 },
      highContrast: this.rt.preferences.highContrast, showLevels: !tutorial,
    };
    this.scene.launch('hud', { view: this.view });
    this.hud = this.scene.get('hud') as ClassroomHUD;

    this.bindInput();
    this.bindEvents();
    this.professor.setState(this.sim.professor.state, null);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.rt.context.setPauseAvailable(true);
    // scene.launch es diferido: el HUD aún no existe aquí. La intro usa toasts y banners,
    // así que espera a que el HUD termine su create (si no, la clase normal se cuelga).
    this.hud.events.once(Phaser.Scenes.Events.CREATE, this.intro, this);
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.monitorPerformance(deltaMs);
    if (this.phase === 'playing') this.sim.update(dt);
    this.syncVisuals(time);
    this.ambientAudio(deltaMs);
    this.updateTutorial();
  }

  // ——— Entrada ———

  private bindInput(): void {
    const { context } = this.rt;
    this.controller = new BalanceTouchController(
      {
        target: context.container,
        canvas: () => this.game.canvas,
        view: GAME_CONFIG.view,
        radius: GAME_CONFIG.joystick.radius,
        deadZone: BALANCE_CONFIG.joystickDeadZone,
      },
      {
        press: () => this.onPress(),
        move: (x, y) => this.sim.setInput(x, y),
        release: () => this.onRelease(),
        cancel: () => this.sim.cancel(),
        interrupted: () => context.requestPause(),
      },
    );
    this.controller.enabled = false;
    this.unsubscribers.push(this.rt.onPause(() => this.controller?.cancel()));
  }

  private onPress(): void {
    if (this.tutorialStep === 'risk') {
      this.finishTutorial();
      return;
    }
    if (this.phase !== 'playing') return;
    this.sim.press();
    const now = this.time.now;
    if (now > this.timers.strain) {
      this.timers.strain = now + 2500;
      this.rt.play(strainSound(this.rt.skin, this.nextVariant()), 'voice');
    }
  }

  private onRelease(): void {
    if (this.phase !== 'playing') return;
    const result = this.sim.release();
    if (this.mode === 'tutorial') this.tutorialRelease(result);
    else if (result.kind === 'tooShort') this.hud.toast('Mantén pulsado para apretar…', '#ffffff', 900);
  }

  // ——— Eventos del aula → efectos ———

  private bindEvents(): void {
    const bus = this.sim.bus;
    const on: typeof bus.on = (type, handler) => {
      const off = bus.on(type, handler);
      this.unsubscribers.push(off);
      return off;
    };

    on('PROFESSOR_STATE', ({ state, targetSeatId }) => {
      const targetX = targetSeatId === PLAYER_TARGET ? this.player.x : targetSeatId ? this.students.get(targetSeatId)?.seat.x ?? null : null;
      this.professor.setState(state, targetX);
      switch (state) {
        case 'warning':
          this.rt.play(footstepsSound);
          if (this.view.attentionEmphasis) {
            this.rt.play(warningBlip);
            this.hud.toast('👀 ¡Apuntes del profe: se va a girar!', '#ffd23f', 900);
          }
          break;
        case 'writing':
          this.classroom.startWriting();
          break;
        case 'explaining':
          if (!this.sim.professor.isSilent) this.professor.say(pick(PROFESSOR_DIALOGUE.lecture), 1800);
          break;
        case 'watching':
          if (Math.random() < 0.4) this.professor.say(pick(PROFESSOR_DIALOGUE.suspicious), 1600);
          break;
        case 'turningBack':
          this.professor.hideBubble();
          break;
      }
    });

    on('RANDOM_EVENT', ({ kind, seatId }) => {
      switch (kind) {
        case 'chalkDrop':
          this.rt.play(chalkDropSound);
          this.hud.toast('¡Se le ha caído la tiza! ¡Ventana segura!', '#8bd450', 1800);
          break;
        case 'erasing':
          this.rt.play(eraseSound);
          this.classroom.eraseOldest();
          this.hud.toast('¡Borrado ruidoso! Buena tapadera…', '#8bd450', 1800);
          break;
        case 'silence':
          this.professor.say('…', 2500);
          this.hud.toast('🤫 Silencio inesperado… ni un ruido', '#ffd23f', 2200);
          break;
        case 'snore':
          if (seatId) this.students.get(seatId)?.snore();
          this.rt.play(snoreSound);
          this.hud.toast('¡Alguien ronca! El profe sospecha…', '#ffd23f', 1800);
          break;
      }
    });

    on('BALANCE_STABILIZED', () => {
      this.rt.play(stableSound, 'stable');
      this.setExpression('relief', 450);
    });

    on('GAS_PRESSURE_CRITICAL', () => this.hud.toast('¡PRESIÓN CRÍTICA! ¡SUELTA YA!', '#ff4d6d', 1400));

    on('SILENT_EMISSION', (e) => {
      const tier = EMISSION_TIERS[e.tier - 1];
      this.rt.play(silenceCueSound);
      this.time.delayedCall(140, () => this.rt.play(silentFartSound(this.rt.skin, e.tier, this.nextVariant()), 'emission'));
      this.player.showPose('sit', 'lift', 700);
      this.cloudColor = Phaser.Display.Color.HexStringToColor(tier.color).color;
      this.fx.silentCloud(this.player.rear, tier.reach, this.cloudColor, this.rt.reducedMotion);
      if (e.detected) return;
      this.setExpression(e.perfect ? 'proud' : 'relief', 1200);
      this.hud.banner(pick(SUCCESS_LINES), '#b5e36b', 44, 600);
      this.hud.toast(`${tier.name}${e.perfect ? ' · ¡CENTRADO PERFECTO!' : ''}`, tier.color, 1300);
    });

    on('STUDENT_FELL_ASLEEP', ({ studentId }) => {
      this.lastStudentId = studentId;
    });

    // Reacciones (IMP-04): la nube viaja hasta cada compañero y reacciona al llegar.
    const shown = { emissionId: -1, messages: 0 };
    on('STUDENT_REACTION', (e) => {
      const student = this.students.get(e.studentId);
      if (!student) return;
      if (shown.emissionId !== e.emissionId) Object.assign(shown, { emissionId: e.emissionId, messages: 0 });
      const order = shown.messages++;
      const head = { x: student.headX, y: student.headY };
      const silent = e.kind === 'silent';
      const color = this.cloudColor;
      if (silent) this.fx.wisp(this.player.rear, head, color);
      const delay = silent ? Math.max(150, (e.distance / REACTION_CONFIG.cloudSpeed) * 1000) : 120 + order * 60;
      this.time.delayedCall(delay, () => {
        student.react(e.anim, e.intensity, this.rt.reducedMotion);
        if (silent && e.intensity >= 0.5) this.fx.faceHit(head, color, e.intensity);
        if (order >= REACTION_CONFIG.maxMessages) return;
        const text = e.bonus > 0 ? `${e.message} +${e.bonus}` : e.message;
        this.fx.comicText(text, head.x, head.y - 44 * student.seat.scale, e.color, e.intensity, this.rt.reducedMotion);
      });
    });

    on('CLASS_REACTION', (e) => {
      const text = e.bonus > 0 ? `${e.message} +${e.bonus}` : e.message;
      if (e.id === 'silentApocalypse') this.fx.silentCloud(this.player.rear, 720, this.cloudColor, this.rt.reducedMotion);
      this.time.delayedCall(e.kind === 'silent' ? 750 : 450, () => {
        this.fx.comicText(text, GAME_CONFIG.view.width / 2, 210, e.color, 1, this.rt.reducedMotion, 26);
      });
    });

    on('TRUMPET_EMISSION', (e) => {
      const variant = TRUMPET_VARIANTS.find((v) => v.variant === e.variant) ?? TRUMPET_VARIANTS[0];
      this.rt.play(trumpetFartSound(this.rt.skin, e.variant, e.intensity, this.nextVariant()), 'emission');
      this.fx.trumpet(this.player.rear, e.intensity, this.rt.reducedMotion);
      this.player.showPose('blast', 'lift', 600);
      this.time.delayedCall(600, () => this.player.showPose('shame', null, 1400));
      this.player.launch(10 + e.intensity * 6, e.intensity >= 5, this.rt.reducedMotion);
      this.professor.flinch();
      this.setExpression('shock', 600);
      this.time.delayedCall(600, () => this.setExpression('embarrassed', 1600));
      this.time.delayedCall(350, () => this.rt.play(gaspSound));
      this.time.delayedCall(900, () => this.rt.play(embarrassedSound(this.rt.skin, this.nextVariant()), 'voice'));
      if (this.mode === 'tutorial') return;
      const title = e.duringSilence ? `${variant.label.toUpperCase()}…\n¡EN PLENO SILENCIO!` : `¡${variant.label.toUpperCase()}!`;
      this.hud.banner(title, '#ff8a3d', 46, 800);
      if (e.intensity >= 4 || e.duringSilence) {
        this.time.delayedCall(1100, () => this.hud.banner('TODA LA CLASE LO HA OÍDO TODO.', '#ff4d6d', 34, 900));
      }
    });

    on('PROFESSOR_DETECTED_PLAYER', (e) => {
      if (e.absorbed) {
        this.hud.toast('🪑 La Silla Insonorizada lo amortigua… (sin aviso)', '#8bd450', 2000);
        return;
      }
      const line = e.expelled
        ? PROFESSOR_DIALOGUE.warnings[2]
        : e.reason === 'seen' ? pick(PROFESSOR_DIALOGUE.caught) : pick([...PROFESSOR_DIALOGUE.caught, PROFESSOR_DIALOGUE.warnings[e.strikes - 1]]);
      this.time.delayedCall(e.reason === 'trumpet' ? 500 : 150, () => this.professor.say(line, 2200, 'shout'));
      if (e.reason === 'seen') {
        this.setExpression('shock', 900);
        this.hud.banner('¡TE HA VISTO!', '#ff4d6d', 50, 700);
      }
      this.time.delayedCall(900, () => this.hud.toast(`⚠ Aviso ${e.strikes} de ${GAME_CONFIG.session.maxStrikes}`, '#ff4d6d', 1500));
    });

    on('SCORE_AWARDED', ({ points, reason }) => {
      // Las reacciones ya enseñan su bonus en su propio texto de cómic.
      if (points === 0 || reason === 'reaction') return;
      const text = points > 0 ? `+${points}` : `${points}`;
      const color = points > 0 ? '#ffd23f' : '#ff8fa3';
      if (reason === 'student' && this.lastStudentId) {
        const s = this.students.get(this.lastStudentId);
        if (s) this.fx.floatingText(text, s.headX, s.headY - 20, color, 20);
        return;
      }
      const head = this.player.head;
      this.fx.floatingText(text, head.x + (reason === 'perfect' ? 60 : reason === 'highPressure' ? -60 : 0), head.y - 20, color);
      if (reason === 'streak') this.hud.banner(`¡RACHA DE ${this.sim.score.streak}! +${points}`, '#b5e36b', 40, 700);
    });

    on('CLASSROOM_CLEARED', () => {
      this.rt.play(fanfareSound);
      this.rt.play(victorySound(this.rt.skin), 'voice');
      this.player.showPose('celebrate', 'relaxed', 3000);
      this.setExpression('proud', 3000);
      this.hud.banner('100% DE ASISTENCIA.\n0% DE CONSCIENCIA.', '#b9a7ff', 40, 1600);
    });

    on('SESSION_ENDED', ({ reason }) => this.endSession(reason));
  }

  // ——— Ritmo de la partida ———

  private intro(): void {
    const tutorial = this.mode === 'tutorial';
    // El protagonista se deja caer en el banco, algo hinchado.
    this.player.lift = -60;
    this.tweens.add({ targets: this.player, lift: 0, duration: 450, ease: 'Bounce.easeOut' });

    if (tutorial) {
      this.time.delayedCall(500, () => {
        this.phase = 'playing';
        if (this.controller) this.controller.enabled = true;
        this.setTutorialStep('hold');
      });
      return;
    }

    const caption = this.rt.campusRun ? '«Todas esas fabes eran una inversión.»' : '¿Quizá tantas fabes no fueron buena idea…?';
    this.hud.toast(caption, '#ffd23f', 1600);
    const steps = GAME_CONFIG.session.countdownSteps;
    for (let i = 0; i <= steps; i++) {
      this.time.delayedCall(1300 + i * 650, () => {
        if (i < steps) {
          this.hud.banner(String(steps - i), '#ffd23f', 100, 250);
          this.rt.play(countdownBeep);
          return;
        }
        this.hud.banner('¡A CLASE!', '#8bd450', 80, 400);
        this.rt.play(goBeep);
        // IMP-01: el arranque es tranquilo; se aprovecha para recordar el control.
        this.time.delayedCall(700, () => this.hud.toast('Mantén pulsado y arrastra: centra las dos burbujas', '#ffffff', 2200));
        this.phase = 'playing';
        if (this.controller) this.controller.enabled = true;
      });
    }
  }

  private endSession(reason: 'time' | 'expelled' | 'cleared'): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    this.controller?.cancel();
    if (this.controller) this.controller.enabled = false;
    this.rt.context.setPauseAvailable(false);
    if (reason === 'time') {
      this.rt.play(bellSound);
      this.hud.banner('¡CLASE TERMINADA!', '#ffd23f', 64, 1200);
    } else if (reason === 'expelled') {
      this.time.delayedCall(600, () => this.rt.play(slamSound));
      this.player.launch(30, true, this.rt.reducedMotion);
      this.time.delayedCall(800, () => this.hud.banner('¡EXPULSADO DE CLASE!', '#ff4d6d', 56, 1200));
    }
    const results = this.rt.finishSession(this.sim.results());
    this.time.delayedCall(reason === 'cleared' ? 3200 : 2600, () => {
      if (results.isNewBest || reason === 'cleared') this.rt.play(fanfareSound);
      this.scene.start('results');
    });
  }

  // ——— Dibujo ———

  private syncVisuals(time: number): void {
    const sim = this.sim;
    const tick = this.professor.update(time);
    if (tick.chalkStroke) {
      this.classroom.writeStep();
      if (Math.random() < 0.5 && !sim.professor.isSilent) this.rt.play(chalkSound);
    }
    for (const s of sim.students.all) this.students.get(s.id)?.setState(s.state, this.rt.reducedMotion);
    for (const student of this.students.values()) student.update(time);

    const { horizontal, vertical } = sim.balance.state;
    const pressureRatio = sim.pressure.ratio;
    const holding = sim.isHolding;
    this.player.update({ horizontal, vertical, pressureRatio, holding, reducedMotion: this.rt.reducedMotion }, time);
    this.classroom.setNightmare(sim.pressure.value >= PRESSURE_CONFIG.nightmareFrom && this.phase === 'playing');
    this.classroom.updateClock(sim.elapsed / GAME_CONFIG.session.durationSec);

    const v = this.view;
    v.score = sim.score.score;
    v.timeLeft = sim.timeLeft;
    v.streak = sim.score.streak;
    v.multiplier = sim.score.multiplier;
    v.asleep = sim.students.asleepCount;
    v.strikesLeft = sim.stealth.remaining;
    v.pressure = sim.pressure.value;
    v.horizontal = horizontal;
    v.vertical = vertical;
    // HUD y liberación leen la misma instantánea (IMP-03).
    const readiness = sim.readiness;
    v.zoneH = readiness.horizontal;
    v.zoneV = readiness.vertical;
    v.holding = holding;
    v.ready = readiness.ready;
    v.blocked = readiness.blocked;
    v.stability = readiness.stability;
    v.attention = sim.professor.attention;
    v.attentionProgress = sim.professor.progress;
    v.silence = sim.professor.isSilent;
    v.expression = this.currentExpression(pressureRatio, holding);
    if (this.controller) Object.assign(v.joystick, this.controller.view);
  }

  private currentExpression(p: number, holding: boolean): Expression {
    if (this.expressionOverride && this.time.now < this.expressionOverride.until) return this.expressionOverride.expression;
    if (holding) return p > 0.85 ? 'breath' : p > 0.55 ? 'sweat' : 'strain';
    return p > 0.7 ? 'sweat' : 'calm';
  }

  private setExpression(expression: Expression, ms: number): void {
    this.expressionOverride = { expression, until: this.time.now + ms };
  }

  /** Sonidos de ambiente. Todos son golpes cortos: al salir no queda ningún bucle sonando. */
  private ambientAudio(deltaMs: number): void {
    if (this.phase !== 'playing') return;
    const sim = this.sim;
    const t = this.timers;
    const p = sim.pressure.ratio;
    t.tick -= deltaMs;
    t.heartbeat -= deltaMs;
    t.mumble -= deltaMs;
    t.lecture -= deltaMs;

    if (p >= 0.4 && !sim.pressure.inRecovery && t.tick <= 0) {
      t.tick = 1000 - p * 650;
      this.rt.play(tickSound(p), 'tick');
      this.hud.tick();
    }
    if (sim.pressure.value >= PRESSURE_CONFIG.nightmareFrom && t.heartbeat <= 0) {
      t.heartbeat = 700;
      this.rt.play(heartbeatSound, 'heart');
      this.hud.heartbeat();
    }
    const state = sim.professor.state;
    const talking = state === 'writing' || state === 'explaining' || state === 'reading';
    if (talking && !sim.professor.isSilent && t.mumble <= 0) {
      t.mumble = Phaser.Math.Between(1800, 3200);
      this.rt.play(mumbleSound(Phaser.Math.Between(3, 6), state === 'explaining' ? 165 : 140), 'mumble');
    }
    if (state === 'writing' && !sim.professor.isSilent && t.lecture <= 0) {
      t.lecture = Phaser.Math.Between(5000, 8000);
      this.professor.say(pick(PROFESSOR_DIALOGUE.lecture), 1600);
    }
  }

  // ——— Tutorial ———

  private setTutorialStep(step: TutorialStep): void {
    this.tutorialStep = step;
    this.hud.tutorial(step === 'done' ? null : TUTORIAL_TEXT[step]);
    if (step === 'balance') this.view.showLevels = true;
    if (step === 'wait') this.time.delayedCall(1300, () => this.sim.professor.setScript('faceBoard'));
  }

  private updateTutorial(): void {
    if (this.mode !== 'tutorial' || this.phase !== 'playing') return;
    const sim = this.sim;
    switch (this.tutorialStep) {
      case 'hold':
        if (sim.isHolding) this.setTutorialStep('balance');
        break;
      case 'balance':
        if (sim.isHolding && sim.balance.isStable) this.setTutorialStep(sim.professor.attention === 'away' ? 'release' : 'wait');
        break;
      case 'wait':
        if (sim.professor.attention === 'away') this.setTutorialStep('release');
        break;
    }
  }

  private tutorialRelease(result: ReleaseResult): void {
    const retry = (message: string) => {
      this.setTutorialStep('hold');
      this.hud.tutorialHint(message);
    };
    switch (result.kind) {
      case 'ignored':
        return;
      case 'tooShort':
      case 'recovering':
        retry('¡Sin soltar! Mantén pulsado mientras equilibras.');
        return;
      case 'professorWatching':
        retry('¡Espera! Te está mirando. Vuelve a apretar.');
        return;
      case 'emission':
        if (result.outcome.kind === 'trumpet') {
          retry('¡Uy! Las burbujas no estaban centradas. Otra vez.');
          return;
        }
        this.hud.tutorial(null);
        this.hud.banner('¡PERFECTO!\nNADIE SE HA ENTERADO.', '#8bd450', 46, 1300);
        this.tutorialStep = 'done';
        this.time.delayedCall(2200, () => this.setTutorialStep('risk'));
    }
  }

  private finishTutorial(): void {
    this.rt.markTutorialDone();
    this.tutorialStep = 'done';
    this.scene.restart({ mode: 'play' });
  }

  private nextVariant(): number {
    this.soundVariant = (this.soundVariant + 1) % VARIANTS_PER_SOUND;
    return this.soundVariant;
  }

  private monitorPerformance(deltaMs: number): void {
    this.slowFrames = deltaMs > 25 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90) this.fx.lowQuality = true;
  }

  private cleanup(): void {
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.hud.events.off(Phaser.Scenes.Events.CREATE, this.intro, this);
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.controller?.dispose();
    this.controller = null;
    this.sim.dispose();
    this.tutorialStep = 'done';
    if (this.scene.isActive('hud')) this.scene.stop('hud');
  }
}
