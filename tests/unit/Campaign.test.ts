import { describe, expect, it } from 'vitest';
import { CampaignManager, type MissionResult } from '../../src/campaign/CampaignManager';
import { CAMPAIGN_CHARACTERS, ROSTER } from '../../src/campaign/config/characters.config';
import { CampaignScoreSystem } from '../../src/campaign/systems/CampaignScoreSystem';
import { CampaignUnlockSystem } from '../../src/campaign/systems/CampaignUnlockSystem';
import { chapterNodes, nextMission } from '../../src/campaign/systems/MissionProgressSystem';
import { missionRunner, type ChapterDefinition, type MissionDefinition } from '../../src/campaign/types';
import type { MissionHost } from '../../src/core/contracts/Mission';
import { emptyCampaignSave, parseCampaignSave } from '../../src/core/progression/CampaignSave';
import { UnlockManager } from '../../src/core/progression/UnlockManager';
import { MemoryStore, SaveManager, type SaveScope } from '../../src/core/services/SaveManager';

interface FakeStats {
  durationSec: number;
}

/** Misión falsa: guarda el anfitrión para que el test juegue "a mano". */
function fakeMission(id: string, code: string, scoring: { allowEarn: boolean; allowLose: boolean }, hosts: Array<MissionHost<FakeStats>>): MissionDefinition {
  return {
    id, code, title: code, environment: '', foundation: '', status: 'playable', scoring,
    briefing: { story: [], controls: [], rules: [] },
    runner: missionRunner<FakeStats>({
      gameId: 'fake',
      start: (_context, host) => {
        hosts.push(host);
        return { start() {}, pause() {}, resume() {}, destroy() {} };
      },
      describe: (stats) => [{ label: 'Tiempo', value: String(stats.durationSec) }],
      durationOf: (stats) => stats.durationSec,
    }),
  };
}

function setup(store = new MemoryStore()) {
  const hosts: Array<MissionHost<FakeStats>> = [];
  const chapter: ChapterDefinition = {
    id: 'pollo',
    number: 1,
    title: 'Test',
    characterId: 'pollo',
    missions: [
      fakeMission('pollo-1-1', '1-1', { allowEarn: true, allowLose: false }, hosts),
      fakeMission('pollo-1-2', '1-2', { allowEarn: false, allowLose: true }, hosts),
      {
        id: 'pollo-1-3', code: '1-3', title: '1-3', environment: '', foundation: '', status: 'planned',
        scoring: { allowEarn: true, allowLose: true }, briefing: { story: [], controls: [], rules: [] },
      },
    ],
  };
  const storage: SaveScope = new SaveManager('test', store).scope('game:togas-campaign');
  const unlocks = new CampaignUnlockSystem(ROSTER, CAMPAIGN_CHARACTERS, [{ characterId: 'pollo', condition: { type: 'initial' } }]);
  const manager = new CampaignManager(storage, { campaignId: 'togas-campaign', chapters: [chapter], characters: CAMPAIGN_CHARACTERS, unlocks });
  return { manager, hosts, chapter, store };
}

/** Juega la misión actual: gana/pierde puntos y termina con el estado indicado. */
function play(
  manager: CampaignManager,
  hosts: Array<MissionHost<FakeStats>>,
  script: (host: MissionHost<FakeStats>) => void,
  status: 'completed' | 'failed',
  reason?: string,
): MissionResult {
  let result: MissionResult | null = null;
  const run = manager.startMission((r) => (result = r));
  expect(run).not.toBeNull();
  run?.mission.runner.start({} as never, run.host);
  const host = hosts[hosts.length - 1];
  script(host);
  host.finish({ status, reason, stats: { durationSec: 30 } });
  if (!result) throw new Error('la misión no avisó al terminar');
  return result;
}

describe('CampaignScoreSystem', () => {
  it('rechaza ganar puntos cuando la misión no lo permite (CAM-009)', () => {
    const score = new CampaignScoreSystem({ currentScore: 500, totalEarned: 500, totalLost: 0 });
    score.setRules({ allowEarn: false, allowLose: true });
    expect(score.apply({ type: 'CAMPAIGN_POINTS_EARNED', amount: 300 }).applied).toBe(0);
    expect(score.score).toBe(500);
  });

  it('nunca baja de cero y avisa al vaciarse (CAM-013)', () => {
    const score = new CampaignScoreSystem({ currentScore: 120, totalEarned: 120, totalLost: 0 });
    score.setRules({ allowEarn: false, allowLose: true });
    expect(score.apply({ type: 'CAMPAIGN_POINTS_LOST', amount: 100 })).toEqual({ applied: -100, score: 20, depleted: false });
    expect(score.apply({ type: 'CAMPAIGN_POINTS_LOST', amount: 100 })).toEqual({ applied: -20, score: 0, depleted: true });
    expect(score.apply({ type: 'CAMPAIGN_POINTS_LOST', amount: 100 }).depleted).toBe(false);
    expect(score.snapshot).toEqual({ currentScore: 0, totalEarned: 120, totalLost: 120 });
  });

  it('ignora cantidades no válidas y bloquea todo entre misiones', () => {
    const score = new CampaignScoreSystem();
    score.setRules({ allowEarn: true, allowLose: true });
    expect(score.apply({ type: 'CAMPAIGN_POINTS_EARNED', amount: Number.NaN }).applied).toBe(0);
    expect(score.apply({ type: 'CAMPAIGN_POINTS_EARNED', amount: -50 }).applied).toBe(0);
    score.lock();
    expect(score.apply({ type: 'CAMPAIGN_POINTS_EARNED', amount: 50 }).applied).toBe(0);
  });
});

describe('Progreso de la campaña', () => {
  it('al empezar solo Pollo está disponible; los otros siete huecos, bloqueados (CAM-002)', () => {
    const { manager } = setup();
    const roster = manager.roster();
    expect(roster).toHaveLength(8);
    expect(roster.filter((s) => s.unlocked).map((s) => s.character?.id)).toEqual(['pollo']);
    expect(roster.filter((s) => !s.unlocked)).toHaveLength(7);
    // Los bloqueados no revelan personaje.
    expect(roster.slice(1).every((s) => s.character === null)).toBe(true);
  });

  it('la puntuación de 1-1 pasa exacta a 1-2, donde solo puede bajar (CAM-008)', () => {
    const { manager, hosts } = setup();
    manager.selectCharacter('pollo');
    const first = play(manager, hosts, (host) => {
      host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 300 });
      host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 137 });
      expect(host.report({ type: 'CAMPAIGN_POINTS_LOST', amount: 50 }).applied).toBe(0);
    }, 'completed');
    expect(first.record.scoreAfter).toBe(437);

    let opening = -1;
    const second = play(manager, hosts, (host) => {
      opening = host.context.startingScore;
      expect(host.score).toBe(437);
      expect(host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 999 }).applied).toBe(0);
      host.report({ type: 'CAMPAIGN_POINTS_LOST', amount: 100 });
    }, 'completed');
    expect(opening).toBe(437);
    expect(second.record).toMatchObject({ scoreBefore: 437, scoreAfter: 337, earned: 0, lost: 100 });
    // 1-3 está reservada: no se puede jugar ni saltar.
    expect(second.attempt.status).toBe('complete');
    expect(manager.startMission(() => undefined)).toBeNull();
  });

  it('una misión fallada se reintenta con la puntuación de entrada', () => {
    const { manager, hosts } = setup();
    manager.selectCharacter('pollo');
    play(manager, hosts, (host) => host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 400 }), 'completed');
    const failed = play(manager, hosts, (host) => host.report({ type: 'CAMPAIGN_POINTS_LOST', amount: 150 }), 'failed', 'caught');
    expect(failed.attempt.status).toBe('failed');
    expect(failed.record.scoreAfter).toBe(250);
    expect(manager.attempt?.score.currentScore).toBe(400);
    expect(manager.startMission(() => undefined)).toBeNull(); // Hay que pedir el reintento.
    expect(manager.retryMission()).toBe(true);
    expect(manager.attempt?.retries).toBe(1);
    expect(manager.currentMission()?.id).toBe('pollo-1-2');
  });

  it('quedarse sin puntos pierde el intento y obliga a empezar el capítulo (CAM-013)', () => {
    const { manager, hosts } = setup();
    manager.selectCharacter('pollo');
    play(manager, hosts, (host) => host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 100 }), 'completed');
    const lost = play(manager, hosts, (host) => {
      expect(host.report({ type: 'CAMPAIGN_POINTS_LOST', amount: 500 }).depleted).toBe(true);
    }, 'failed', 'bankrupt');
    expect(lost.attempt.status).toBe('lost');
    expect(manager.retryMission()).toBe(false);
    expect(manager.restartChapter()).toBe(true);
    expect(manager.attempt).toMatchObject({ status: 'ready', currentMissionId: 'pollo-1-1', completedMissionIds: [] });
    expect(manager.attempt?.score.currentScore).toBe(0);
  });

  it('el progreso sobrevive a recargas y una misión a medias cuenta como interrumpida (CAM-015)', () => {
    const store = new MemoryStore();
    const a = setup(store);
    a.manager.markIntroSeen();
    a.manager.selectCharacter('pollo');
    play(a.manager, a.hosts, (host) => host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 640 }), 'completed');
    // Empieza 1-2 y "se cierra la pestaña" sin terminar.
    a.manager.startMission(() => undefined);

    const b = setup(store);
    expect(b.manager.state.introSeen).toBe(true);
    expect(b.manager.attempt).toMatchObject({
      status: 'failed', currentMissionId: 'pollo-1-2', completedMissionIds: ['pollo-1-1'],
      failure: { missionId: 'pollo-1-2', reason: 'interrupted' },
    });
    expect(b.manager.attempt?.score.currentScore).toBe(640);
  });

  it('los resultados de una misión solo se cuentan una vez', () => {
    const { manager, hosts } = setup();
    manager.selectCharacter('pollo');
    const results: MissionResult[] = [];
    const run = manager.startMission((r) => results.push(r));
    run?.mission.runner.start({} as never, run.host);
    const host = hosts[0];
    host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 10 });
    host.finish({ status: 'completed', stats: { durationSec: 1 } });
    host.finish({ status: 'failed', reason: 'x', stats: { durationSec: 1 } });
    expect(host.report({ type: 'CAMPAIGN_POINTS_EARNED', amount: 10 }).applied).toBe(0);
    expect(results).toHaveLength(1);
  });

  it('los nodos del mapa siguen el orden y marcan la reservada como pendiente', () => {
    const { chapter } = setup();
    expect(nextMission(chapter, [])?.id).toBe('pollo-1-1');
    expect(nextMission(chapter, ['pollo-1-1', 'pollo-1-2'])).toBeNull();
    expect(chapterNodes(chapter, null).map((n) => n.state)).toEqual(['available', 'locked', 'notImplemented']);
  });
});

describe('Guardado de campaña', () => {
  it('rechaza datos corruptos o manipulados', () => {
    const valid = emptyCampaignSave(['pollo']);
    expect(parseCampaignSave(valid)).toEqual(valid);
    expect(parseCampaignSave(null)).toBeNull();
    expect(parseCampaignSave({ ...valid, version: 99 })).toBeNull();
    expect(parseCampaignSave({ ...valid, unlockedCharacterIds: ['<script>'] })).toBeNull();
    expect(parseCampaignSave({ ...valid, bestChapterScores: { pollo: -5 } })).toBeNull();
    const attempt = {
      chapterId: 'pollo', characterId: 'pollo', status: 'ready', currentMissionId: 'pollo-1-1', completedMissionIds: [],
      score: { currentScore: 10.5, totalEarned: 0, totalLost: 0 }, missionEntryScore: 0, retries: 0, durationSec: 0, ledger: {}, failure: null,
    };
    expect(parseCampaignSave({ ...valid, attempt })).toBeNull();
  });
});

describe('UnlockManager', () => {
  it('evalúa condiciones como datos, sin umbrales fijos en la interfaz', () => {
    const manager = new UnlockManager([
      { characterId: 'a', condition: { type: 'initial' } },
      { characterId: 'b', condition: { type: 'chapterCompleted', chapterId: 'pollo', minScore: 1000 } },
    ]);
    expect(manager.initial()).toEqual(['a']);
    expect(manager.newlyUnlocked({ completedChapters: { pollo: 999 } }, ['a'])).toEqual([]);
    expect(manager.newlyUnlocked({ completedChapters: { pollo: 1000 } }, ['a'])).toEqual(['b']);
  });
});
