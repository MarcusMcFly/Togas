import type { MissionHost } from '../../../core/contracts/Mission';
import type { ClassroomMissionStats, ClassroomPenalties } from '../runtime';
import type { ClassroomSimulation } from './ClassroomSimulation';

/** Por qué se han perdido puntos (para enseñarlo en pantalla). */
export type LossReason = 'chairFall' | 'uncontrolledRelease' | 'time';

/**
 * Traduce lo que pasa en el aula a eventos de campaña. Aquí no se gana NINGÚN punto:
 * solo se informa de pérdidas, y el anfitrión es quien decide la puntuación.
 * Si la puntuación de campaña llega a cero, la clase termina (`bankrupt`).
 */
export class MissionScoreBridge {
  private drainCarry = 0;
  private readonly unsubscribers: Array<() => void>;

  constructor(
    private readonly sim: ClassroomSimulation,
    private readonly host: MissionHost<ClassroomMissionStats>,
    private readonly penalties: ClassroomPenalties,
    private readonly onLoss: (points: number, reason: LossReason) => void = () => undefined,
  ) {
    const bus = sim.bus;
    this.unsubscribers = [
      bus.on('CHAIR_FALL', (e) => {
        host.report({ type: 'CHAIR_FALL', fallCount: e.fallCount });
        this.lose(penalties.chairFall, 'chairFall');
      }),
      bus.on('TRUMPET_EMISSION', () => {
        // Con el profe mirando ya es fallo de misión: no se cobra además la penalización.
        if (!sim.professorLooking) this.lose(penalties.uncontrolledRelease, 'uncontrolledRelease');
      }),
      bus.on('STUDENT_FELL_ASLEEP', (e) => host.report({ type: 'STUDENT_AFFECTED', studentId: e.studentId })),
      bus.on('ARISTOCRAT_DEFEATED', () => host.report({ type: 'ARISTOCRAT_DEFEATED' })),
    ];
  }

  /** Goteo por tiempo de clase activa. Llamar solo mientras se juega. */
  update(dt: number): void {
    if (this.sim.ended || this.penalties.drainPerSec <= 0) return;
    this.drainCarry += dt * this.penalties.drainPerSec;
    const whole = Math.floor(this.drainCarry);
    if (whole <= 0) return;
    this.drainCarry -= whole;
    this.lose(whole, 'time');
  }

  dispose(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers.length = 0;
  }

  private lose(amount: number, reason: LossReason): void {
    if (amount <= 0 || this.sim.ended) return;
    const change = this.host.report({ type: 'CAMPAIGN_POINTS_LOST', amount });
    if (change.applied !== 0) this.onLoss(-change.applied, reason);
    if (change.depleted) this.sim.abort('bankrupt');
  }
}
