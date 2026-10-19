import type { StatRow } from '../../core/progression/CampaignSave';
import type { ClassroomMissionStats } from '../../games/togas-silent-class/mission';
import type { WalkingMissionStats } from '../../games/togas-walking-arround/mission';

/**
 * Convierte las estadísticas propias de cada minijuego en filas para la pantalla de
 * resultados de la campaña. Los puntos de campaña (inicial, perdidos, final) los
 * añade el orquestador: aquí solo va lo específico de cada misión.
 */

const num = (n: number): string => n.toLocaleString('es-ES');
const percent = (ratio: number): string => `${Math.round(ratio * 100)} %`;
export const duration = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

export function describeWalking(stats: WalkingMissionStats, specialFood: string): StatRow[] {
  const stars = '★'.repeat(stats.wanted) + '☆'.repeat(Math.max(0, stats.maxWanted - stats.wanted));
  return [
    { label: 'Puntos ganados', value: num(stats.pointsEarned) },
    { label: `${specialFood} recogidas`, value: num(stats.specialCollected) },
    { label: 'Otra comida recogida', value: num(stats.otherCollected) },
    { label: 'Pedos sin testigos', value: `${stats.cleanEmissions} de ${stats.emissions}` },
    { label: 'Viandantes afectados', value: num(stats.pedestriansAffected) },
    { label: 'Multiplicador máximo', value: `×${stats.bestMultiplier.toLocaleString('es-ES', { maximumFractionDigits: 2 })}` },
    { label: 'Búsqueda policial final', value: stars || '—' },
    { label: 'Tropiezos', value: num(stats.stumbles) },
    { label: 'Tiempo', value: duration(stats.durationSec) },
  ];
}

export function describeClassroom(stats: ClassroomMissionStats): StatRow[] {
  return [
    { label: 'Compañeros K.O.', value: `${stats.studentsAffected} / ${stats.totalStudents}` },
    { label: 'Aristócrata', value: stats.aristocratDefeated ? 'Neutralizado' : 'Sigue en pie' },
    { label: 'Pedos silenciosos', value: num(stats.silentEmissions) },
    { label: 'Trompetazos accidentales', value: num(stats.trumpetFarts) },
    { label: 'Caídas de la silla', value: num(stats.chairFalls) },
    { label: 'Presión máxima', value: `${stats.peakPressure} %` },
    { label: 'Precisión media', value: percent(stats.accuracy) },
    { label: 'Aguante más largo', value: `${stats.longestHoldSec.toLocaleString('es-ES', { maximumFractionDigits: 1 })} s` },
    { label: 'El profe…', value: stats.detection === 'caught' ? '¡Te pilló!' : 'No se enteró de nada' },
    { label: 'Tiempo de misión', value: duration(stats.durationSec) },
  ];
}
