import { describe, expect, it } from 'vitest';
import { COMMUTE_SPAWN, LENTIL_COMMUTE_RULESET } from '../../src/campaign/chapters/pollo/level-1-1/walking-campaign.config';
import { SILENT_CLASS_PENALTIES, SILENT_CLASS_RULES } from '../../src/campaign/chapters/pollo/level-1-2/classroom-campaign.config';
import type { CampaignEvent, MissionHost } from '../../src/core/contracts/Mission';
import { TapSwipeRecognizer } from '../../src/core/services/GestureInput';
import { Random } from '../../src/core/utils/Random';
import { STANDALONE_CLASSROOM_RULES } from '../../src/games/togas-silent-class/config/ruleset';
import type { ClassroomMissionStats } from '../../src/games/togas-silent-class/runtime';
import { ClassroomSimulation } from '../../src/games/togas-silent-class/systems/ClassroomSimulation';
import { MissionScoreBridge } from '../../src/games/togas-silent-class/systems/MissionScoreBridge';
import { OBSTACLES, OBSTACLE_HITBOX } from '../../src/games/togas-walking-arround/config/collectibles.config';
import { GAME_CONFIG } from '../../src/games/togas-walking-arround/config/game.config';
import { STANDALONE_RULESET } from '../../src/games/togas-walking-arround/config/ruleset';
import { SPAWN_CONFIG } from '../../src/games/togas-walking-arround/config/spawn.config';
import { TRAVERSAL_OBSTACLES, traversalById } from '../../src/games/togas-walking-arround/config/traversal.config';
import { overlaps, setRect, type Rect } from '../../src/games/togas-walking-arround/systems/CollisionSystem';
import { EmissionSystem } from '../../src/games/togas-walking-arround/systems/EmissionSystem';
import { RunnerSystem, airTime, jumpApex, minObstacleGap } from '../../src/games/togas-walking-arround/systems/RunnerSystem';
import { SpawnSystem, type SpawnRequest } from '../../src/games/togas-walking-arround/systems/SpawnSystem';
import { StreetSystem } from '../../src/games/togas-walking-arround/systems/StreetSystem';

const DT = 1 / 60;
const street = LENTIL_COMMUTE_RULESET.street!;

describe('1-1 · Reglas de la calle', () => {
  it('las lentejas valen ×3 y el resto ×1, antes del multiplicador de emisiones (CAM-003)', () => {
    const s = new StreetSystem(street);
    const lentils = LENTIL_COMMUTE_RULESET.itemMultipliers.lentils;
    expect(lentils).toBe(3);
    expect(s.points(100, lentils)).toBe(300);
    expect(s.points(100, LENTIL_COMMUTE_RULESET.itemMultipliers.fabes ?? 1)).toBe(100);
    s.resolveEmission(0);
    s.resolveEmission(0);
    expect(s.multiplier).toBe(1.5);
    // Base × 3 × multiplicador de emisiones activo.
    expect(s.points(100, lentils)).toBe(450);
  });

  it('el multiplicador de emisiones sube 0,25 por pedo limpio y no pasa de ×3', () => {
    const s = new StreetSystem(street);
    for (let i = 0; i < 20; i++) s.resolveEmission(0);
    expect(s.multiplier).toBe(3);
    expect(s.bestMultiplier).toBe(3);
    expect(s.boost).toBeGreaterThan(0);
  });

  it('un testigo cerca reinicia el multiplicador y suma una estrella (CAM-005)', () => {
    const s = new StreetSystem(street);
    s.resolveEmission(0);
    const verdict = s.resolveEmission(2);
    expect(verdict).toMatchObject({ clean: false, witnesses: 2, multiplier: 1, wanted: 1, arrested: false });
    expect(s.pedestriansAffected).toBe(2);
  });

  it('con cinco estrellas, detenido (CAM-006)', () => {
    const s = new StreetSystem(street);
    let verdict = s.resolveEmission(1);
    for (let i = 0; i < 4; i++) verdict = s.resolveEmission(1);
    expect(verdict.wanted).toBe(5);
    expect(verdict.arrested).toBe(true);
  });

  it('los pedos son automáticos y siempre pedos en la campaña (CAM-004)', () => {
    const emissions = new EmissionSystem(3, new Random(1), () => 'fart');
    expect([1, 2, 3, 4].map((index) => emissions.resolve({ index, tier: 1 }).type)).toEqual(['fart', 'fart', 'fart', 'fart']);
    expect(LENTIL_COMMUTE_RULESET.emissions).toBe('fartOnly');
  });
});

describe('1-1 · Control con un dedo (CAM-007)', () => {
  it('un toque es un salto', () => {
    const g = new TapSwipeRecognizer();
    g.down(1, 0.5, 0.5);
    expect(g.move(1, 0.51, 0.52)).toBeNull();
    expect(g.up(1, 0.51, 0.52)).toBe('tap');
  });

  it('deslizar hacia abajo es rodar, al instante y sin salto al soltar', () => {
    const g = new TapSwipeRecognizer();
    g.down(1, 0.5, 0.3);
    expect(g.move(1, 0.5, 0.34)).toBeNull();
    expect(g.move(1, 0.51, 0.4)).toBe('swipeDown');
    expect(g.move(1, 0.51, 0.6)).toBeNull();
    expect(g.up(1, 0.51, 0.6)).toBeNull();
  });

  it('ignora el segundo dedo y los contactos cancelados', () => {
    const g = new TapSwipeRecognizer();
    g.down(1, 0.5, 0.5);
    g.down(2, 0.2, 0.2);
    expect(g.up(2, 0.2, 0.2)).toBeNull();
    g.cancel(1);
    expect(g.up(1, 0.5, 0.5)).toBeNull();
  });

  it('un deslizamiento lateral no es rodar', () => {
    const g = new TapSwipeRecognizer();
    g.down(1, 0.2, 0.5);
    expect(g.move(1, 0.5, 0.58)).toBeNull();
  });
});

describe('1-1 · Saltar y rodar', () => {
  const runner = GAME_CONFIG.runner;
  const roll = runner.roll;

  it('rodar baja la caja de colisión durante un rato y saltar lo interrumpe', () => {
    const r = new RunnerSystem(runner);
    r.pressRoll();
    r.update(DT, 0);
    expect(r.rolling).toBe(true);
    for (let t = 0; t < roll.durationSec + 0.1; t += DT) r.update(DT, 0);
    expect(r.rolling).toBe(false);
    r.pressRoll();
    r.update(DT, 0);
    r.pressJump();
    r.update(DT, 0);
    expect(r.rolling).toBe(false);
    expect(r.grounded).toBe(false);
  });

  it('pedir rodar en el aire hace caer rápido y rodar al aterrizar', () => {
    const r = new RunnerSystem(runner);
    r.pressJump();
    for (let i = 0; i < 10; i++) r.update(DT, 0);
    r.pressRoll();
    let t = 0;
    while (!r.grounded && t < 2) {
      r.update(DT, 0);
      t += DT;
    }
    expect(t).toBeLessThan(airTime(runner));
    expect(r.rolling).toBe(true);
  });

  it('los obstáculos de saltar se superan con un salto y los de rodar solo rodando', () => {
    const box: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const player: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const { playerHitbox, rollHitboxHeight } = GAME_CONFIG;
    for (const def of TRAVERSAL_OBSTACLES) {
      setRect(box, 0, def.hitbox.bottom, def.hitbox.width, def.hitbox.height);
      if (def.action === 'jump') {
        expect(jumpApex(runner)).toBeGreaterThan(def.hitbox.bottom + def.hitbox.height);
      } else {
        // De pie choca, rodando pasa y saltando tampoco se libra.
        expect(overlaps(setRect(player, 0, 0, playerHitbox.width, playerHitbox.height), box)).toBe(true);
        expect(overlaps(setRect(player, 0, 0, playerHitbox.width, rollHitboxHeight), box)).toBe(false);
        expect(overlaps(setRect(player, 0, jumpApex(runner), playerHitbox.width, playerHitbox.height), box)).toBe(true);
        // Rodando a la velocidad mínima da tiempo a pasar por debajo.
        expect(roll.durationSec * runner.startSpeed).toBeGreaterThan(def.hitbox.width + playerHitbox.width);
      }
    }
  });

  it('el recorrido de la campaña nunca junta obstáculos imposibles', () => {
    const defs = LENTIL_COMMUTE_RULESET.traversal.map((id) => traversalById(id)!);
    const widest = Math.max(OBSTACLE_HITBOX.width, ...defs.map((d) => d.hitbox.width));
    const topSpeed = street.speedBoost.maxSpeed;
    const gap = minObstacleGap({ ...runner, maxSpeed: topSpeed }, GAME_CONFIG.playerHitbox.width, widest, COMMUTE_SPAWN.obstacleMargin);
    const barriers = { jump: defs.filter((d) => d.action === 'jump'), roll: defs.filter((d) => d.action === 'roll') };
    const goal = LENTIL_COMMUTE_RULESET.goal;
    const distance = goal.kind === 'distance' ? goal.distance : 0;
    for (let seed = 1; seed <= 20; seed++) {
      const spawner = new SpawnSystem(COMMUTE_SPAWN, LENTIL_COMMUTE_RULESET.collectibles, OBSTACLES, new Random(seed), gap, barriers);
      const out: SpawnRequest[] = [];
      for (let d = 0; d <= distance; d += 200) spawner.update(d + 1000, d / distance, out);
      const xs = out.filter((r) => r.kind !== 'collectible').map((r) => r.x).sort((a, b) => a - b);
      expect(out.some((r) => r.kind === 'barrier')).toBe(true);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `semilla ${seed}`).toBeGreaterThanOrEqual(gap - 1e-6);
    }
  });
});

/** Anfitrión de prueba con la misma regla que la campaña en 1-2: solo se pierde. */
function lossOnlyHost(start: number) {
  let score = start;
  const events: CampaignEvent[] = [];
  const host: MissionHost<ClassroomMissionStats> = {
    context: {
      mode: 'campaign', campaignId: 'c', chapterId: 'pollo', missionId: 'pollo-1-2', characterId: 'pollo', skinId: 'pollo',
      startingScore: start, rulesetId: 'pollo-1-2',
    },
    get score() {
      return score;
    },
    report(event) {
      events.push(event);
      if (event.type !== 'CAMPAIGN_POINTS_LOST') return { applied: 0, score, depleted: false };
      const before = score;
      score = Math.max(0, score - event.amount);
      return { applied: score - before, score, depleted: before > 0 && score === 0 };
    },
    finish() {},
  };
  return { host, events, get score() { return score; } };
}

const campaignSim = (seed: number) => new ClassroomSimulation({ seed, perk: null, forgiving: false, tutorial: false, rules: SILENT_CLASS_RULES });

describe('1-2 · Clase silenciosa en la campaña', () => {
  it('tres caídas de la silla: expulsión inmediata (CAM-010)', () => {
    const sim = campaignSim(1);
    const falls: number[] = [];
    sim.bus.on('CHAIR_FALL', (e) => falls.push(e.fallCount));
    let guard = 0;
    while (!sim.ended && guard++ < 60 * 60) {
      if (!sim.isHolding && !sim.pressure.inRecovery) sim.press();
      sim.setInput(1, 0); // Empujar la burbuja contra el borde a propósito.
      sim.update(DT);
    }
    expect(falls).toEqual([1, 2, 3]);
    expect(sim.ended).toBe('fallen');
  });

  it('caerse avisa antes y cuesta puntos y el gas, nunca los gana', () => {
    const sim = campaignSim(2);
    const tracker = lossOnlyHost(1000);
    const bridge = new MissionScoreBridge(sim, tracker.host, { ...SILENT_CLASS_PENALTIES, drainPerSec: 0 });
    let wobbles = 0;
    sim.bus.on('CHAIR_WOBBLE', () => wobbles++);
    sim.press();
    sim.setInput(1, 0);
    let guard = 0;
    while (sim.falls === 0 && guard++ < 600) sim.update(DT);
    expect(wobbles).toBeGreaterThan(0);
    expect(sim.falls).toBe(1);
    expect(sim.isHolding).toBe(false);
    expect(tracker.score).toBe(1000 - SILENT_CLASS_PENALTIES.chairFall);
    expect(tracker.events.some((e) => e.type === 'CAMPAIGN_POINTS_EARNED')).toBe(false);
    bridge.dispose();
  });

  it('soltar con el profe mirando: misión fallida al instante (CAM-011)', () => {
    const sim = campaignSim(3);
    let guard = 0;
    while (!sim.professorLooking && guard++ < 60 * 30) sim.update(DT);
    expect(sim.professorLooking).toBe(true);
    sim.press();
    for (let i = 0; i < 30 && !sim.ended; i++) sim.update(DT);
    sim.release();
    expect(sim.ended).toBe('caught');
  });

  it('sin reloj: cada segundo de clase cuesta 1 punto y a cero se acaba la misión', () => {
    const sim = campaignSim(4);
    const tracker = lossOnlyHost(8);
    const bridge = new MissionScoreBridge(sim, tracker.host, SILENT_CLASS_PENALTIES);
    let t = 0;
    while (!sim.ended && t < 20) {
      sim.update(DT);
      bridge.update(DT);
      t += DT;
    }
    // Ocho puntos = ocho segundos de clase (antes de que la presión fuerce nada).
    expect(t).toBeGreaterThan(7.9);
    expect(t).toBeLessThan(8.2);
    expect(sim.ended).toBe('bankrupt');
    expect(tracker.score).toBe(0);
    bridge.dispose();
  });

  it('un trompetazo con el profe de espaldas cuesta puntos pero no termina la misión', () => {
    const sim = campaignSim(5);
    const tracker = lossOnlyHost(1000);
    const bridge = new MissionScoreBridge(sim, tracker.host, { ...SILENT_CLASS_PENALTIES, drainPerSec: 0 });
    let guard = 0;
    while (sim.professor.attention !== 'away' && guard++ < 600) sim.update(DT);
    sim.press();
    sim.setInput(1, 1);
    for (let i = 0; i < 20; i++) sim.update(DT);
    expect(sim.professorLooking).toBe(false);
    sim.release();
    expect(sim.ended).toBeNull();
    expect(tracker.score).toBe(1000 - SILENT_CLASS_PENALTIES.uncontrolledRelease);
    bridge.dispose();
  });

  it('el profe solo es objetivo con los 12 compañeros K.O.; después, un pedo silencioso le derrota (CAM-012)', () => {
    let defeated = 0;
    for (let seed = 1; seed <= 12 && defeated === 0; seed++) {
      const sim = campaignSim(seed);
      let asleep = 0;
      let targetedAt = -1;
      sim.bus.on('STUDENT_FELL_ASLEEP', () => asleep++);
      sim.bus.on('PROFESSOR_TARGETED', () => (targetedAt = asleep));
      // Bot cuidadoso: corrige las burbujas y suelta solo con el profe de espaldas y presión alta.
      let guard = 0;
      while (!sim.ended && guard++ < 60 * 600) {
        if (!sim.isHolding && !sim.pressure.inRecovery) sim.press();
        const { horizontal, vertical } = sim.balance.state;
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        sim.setInput(clamp(-horizontal * 6), clamp(-vertical * 6));
        sim.update(DT);
        const away = sim.professor.attention === 'away';
        if (sim.isHolding && away && sim.balance.isStable && sim.pressure.value >= 82 && !sim.pressure.inRecovery) sim.release();
      }
      if (sim.ended === 'defeated') {
        defeated++;
        expect(targetedAt).toBe(12);
        expect(sim.results().studentsKnockedOut).toBe(12);
      } else {
        expect(sim.ended === 'caught' || sim.ended === 'fallen' || sim.ended === null, `semilla ${seed}: ${sim.ended}`).toBe(true);
      }
    }
    expect(defeated).toBeGreaterThan(0);
  });
});

describe('Modos normales intactos (CAM-014)', () => {
  it('los reglamentos normales conservan las reglas originales', () => {
    expect(STANDALONE_RULESET).toMatchObject({
      emissions: 'alternate', controls: 'holdToJump', traversal: [], street: null, pedestriansBothWays: false, itemMultipliers: {},
      goal: { kind: 'time', durationSec: GAME_CONFIG.session.durationSec },
    });
    expect(STANDALONE_RULESET.spawn).toBe(SPAWN_CONFIG);
    expect(STANDALONE_RULESET.collectibles.some((c) => c.id === 'lentils')).toBe(false);
    expect(STANDALONE_CLASSROOM_RULES).toMatchObject({ detection: 'strikes', chair: null, objective: 'standard', timeLimitSec: 90, aristocrat: false });
  });

  it('sin reglamento, la clase normal sigue con avisos y sin caídas', () => {
    const sim = new ClassroomSimulation({ seed: 3, perk: null, forgiving: false, tutorial: false });
    sim.press();
    sim.setInput(1, 0);
    for (let i = 0; i < 60 * 5; i++) sim.update(DT);
    expect(sim.falls).toBe(0);
    expect(sim.ended).toBeNull();
  });
});
