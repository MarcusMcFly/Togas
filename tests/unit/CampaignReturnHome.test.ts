import { describe, expect, it, vi } from 'vitest';

// El capítulo enlaza con los minijuegos (Phaser necesita un navegador): aquí basta con un esqueleto.
vi.mock('phaser', () => {
  class Scene {}
  return { default: { Scene, AUTO: 0, Scale: {}, Scenes: { Events: {} } } };
});
import { CampaignManager } from '../../src/campaign/CampaignManager';
import { POLLO_CHAPTER } from '../../src/campaign/chapters/pollo/chapter.config';
import { LENTIL_COMMUTE_RULESET } from '../../src/campaign/chapters/pollo/level-1-1/walking-campaign.config';
import { RETURN_HOME_RULESET } from '../../src/campaign/chapters/pollo/level-1-3/return-campaign.config';
import { CAMPAIGN_CHARACTERS, ROSTER } from '../../src/campaign/config/characters.config';
import { describeWalking } from '../../src/campaign/systems/MissionResultAdapter';
import { CampaignScoreSystem } from '../../src/campaign/systems/CampaignScoreSystem';
import { CampaignUnlockSystem } from '../../src/campaign/systems/CampaignUnlockSystem';
import { describeNextCharacter, isChapterInDevelopment, nextCharacterStatus } from '../../src/campaign/systems/MissionProgressSystem';
import { emptyCampaignSave } from '../../src/core/progression/CampaignSave';
import { MemoryStore, SaveManager } from '../../src/core/services/SaveManager';
import type { WalkingMissionStats } from '../../src/games/togas-walking-arround/mission';
import { GAME_CONFIG } from '../../src/games/togas-walking-arround/config/game.config';
import { StreetSystem } from '../../src/games/togas-walking-arround/systems/StreetSystem';
import { ViewDirection } from '../../src/games/togas-walking-arround/systems/ViewDirection';

const returnStreet = RETURN_HOME_RULESET.street!;

describe('1-3 · Vuelta a la base: reglamento', () => {
  it('es la ciudad de 1-1 de noche y al revés, de la universidad a casa', () => {
    expect(RETURN_HOME_RULESET).toMatchObject({ direction: 'reverse', night: true, controls: 'tapAndSwipe', emissions: 'fartOnly' });
    expect(RETURN_HOME_RULESET.goal).toMatchObject({ kind: 'distance', origin: 'university', destination: 'home', requiresPoints: false });
    // Mismo juego que 1-1: comida, obstáculos y multiplicadores.
    expect(RETURN_HOME_RULESET.spawn).toBe(LENTIL_COMMUTE_RULESET.spawn);
    expect(RETURN_HOME_RULESET.collectibles).toBe(LENTIL_COMMUTE_RULESET.collectibles);
    expect(RETURN_HOME_RULESET.itemMultipliers).toEqual(LENTIL_COMMUTE_RULESET.itemMultipliers);
    expect(returnStreet.multiplier).toEqual(LENTIL_COMMUTE_RULESET.street!.multiplier);
    // 1-1 no cambia.
    expect(LENTIL_COMMUTE_RULESET).toMatchObject({ direction: 'forward', night: false });
    expect(LENTIL_COMMUTE_RULESET.street!.witnessPenalty).toEqual({ kind: 'police', maxWanted: 5 });
  });

  it('un pedo con testigos cuesta puntos y reinicia el multiplicador, sin policía ni detención', () => {
    const s = new StreetSystem(returnStreet);
    s.resolveEmission(0);
    s.resolveEmission(0);
    expect(s.multiplier).toBe(1.5);
    let verdict = s.resolveEmission(3);
    expect(verdict).toMatchObject({ clean: false, multiplier: 1, wanted: 0, arrested: false, pointsPenalty: 300 });
    for (let i = 0; i < 20; i++) verdict = s.resolveEmission(1);
    expect(verdict.arrested).toBe(false);
    expect(s.maxWanted).toBe(0);
    expect(s.witnessedEmissions).toBe(21);
    // Un pedo limpio no cuesta nada.
    expect(s.resolveEmission(0).pointsPenalty).toBe(0);
  });

  it('en 1-1 los testigos siguen costando estrellas, no puntos', () => {
    const verdict = new StreetSystem(LENTIL_COMMUTE_RULESET.street!).resolveEmission(1);
    expect(verdict).toMatchObject({ wanted: 1, pointsPenalty: 0 });
  });

  it('los puntos de campaña nunca bajan de cero aunque te huelan mucho', () => {
    const score = new CampaignScoreSystem({ currentScore: 500, totalEarned: 500, totalLost: 0 });
    score.setRules(POLLO_CHAPTER.missions[2].scoring);
    expect(score.apply({ type: 'CAMPAIGN_POINTS_EARNED', amount: 100 }).applied).toBe(100);
    score.apply({ type: 'CAMPAIGN_POINTS_LOST', amount: 300 });
    expect(score.apply({ type: 'CAMPAIGN_POINTS_LOST', amount: 300 }).score).toBe(0);
    expect(score.score).toBe(0);
  });
});

describe('1-3 · Sentido de la marcha', () => {
  it('al revés, la X se refleja en pantalla y el sentido se invierte', () => {
    const view = new ViewDirection(true);
    const width = GAME_CONFIG.view.width;
    expect(view.facing).toBe(-1);
    expect(view.x(width * GAME_CONFIG.playerAnchorX)).toBe(width * 0.75);
    expect(view.x(view.x(123))).toBe(123);
    expect(view.dir(1)).toBe(-1);
    const forward = new ViewDirection(false);
    expect(forward.x(123)).toBe(123);
    expect(forward.dir(-1)).toBe(-1);
  });
});

describe('1-3 · Capítulo y desbloqueo', () => {
  it('el capítulo de Pollo ya no tiene misiones pendientes', () => {
    expect(POLLO_CHAPTER.missions.map((m) => m.status)).toEqual(['playable', 'playable', 'playable']);
    expect(isChapterInDevelopment(POLLO_CHAPTER)).toBe(false);
    expect(POLLO_CHAPTER.missions[2].scoring).toEqual({ allowEarn: true, allowLose: true });
  });

  it('la puntuación final decide si se alcanza el umbral del siguiente personaje', () => {
    const required = POLLO_CHAPTER.nextCharacterScore!;
    expect(nextCharacterStatus(POLLO_CHAPTER, required)).toEqual({ required, score: required, reached: true });
    const short = nextCharacterStatus(POLLO_CHAPTER, required - 250)!;
    expect(short.reached).toBe(false);
    expect(describeNextCharacter(short)).toContain('250');
    expect(describeNextCharacter(short, ['Alguien'])).toContain('Alguien');
  });

  it('un personaje añadido después se desbloquea con la puntuación ya guardada', () => {
    const store = new MemoryStore();
    const storage = new SaveManager('test', store).scope('game:togas-campaign');
    storage.set('campaign', { ...emptyCampaignSave(['pollo']), bestChapterScores: { pollo: 16000 } });
    const unlocks = new CampaignUnlockSystem(ROSTER, CAMPAIGN_CHARACTERS, [
      { characterId: 'pollo', condition: { type: 'initial' } },
      { characterId: 'next', condition: { type: 'chapterCompleted', chapterId: 'pollo', minScore: 15000 } },
      { characterId: 'later', condition: { type: 'chapterCompleted', chapterId: 'pollo', minScore: 20000 } },
    ]);
    const manager = new CampaignManager(storage, { campaignId: 'togas-campaign', chapters: [POLLO_CHAPTER], characters: CAMPAIGN_CHARACTERS, unlocks });
    expect(manager.state.unlockedCharacterIds).toEqual(['pollo', 'next']);
  });

  it('los resultados de 1-3 hablan de testigos y puntos perdidos, no de policía', () => {
    const stats: WalkingMissionStats = {
      pointsEarned: 4000, collected: {}, specialCollected: 10, otherCollected: 20, emissions: 8, cleanEmissions: 6,
      witnessedEmissions: 2, pointsLost: 600, pedestriansAffected: 3, bestMultiplier: 2, wanted: 0, maxWanted: 0,
      stumbles: 1, durationSec: 70,
    };
    const labels = describeWalking(stats, 'Lentejas').map((r) => r.label);
    expect(labels).toContain('Puntos perdidos por testigos');
    expect(labels).not.toContain('Búsqueda policial final');
    const police = describeWalking({ ...stats, maxWanted: 5 }, 'Lentejas').map((r) => r.label);
    expect(police).toContain('Búsqueda policial final');
  });
});
