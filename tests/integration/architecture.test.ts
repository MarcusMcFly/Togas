import { describe, expect, it } from 'vitest';

// Vite carga el texto de cada fichero fuente: sin depender de las APIs de Node.
const SOURCES = import.meta.glob('../../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ROOT = '../../src/';

const IMPORT = /from\s+'([^']+)'/g;

/** Resuelve una importación relativa a ruta desde src/ (p. ej. "games/x/config/a"). */
function resolveImport(file: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const parts = file.slice(ROOT.length).split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

function importsOf(file: string): string[] {
  return [...SOURCES[file].matchAll(IMPORT)].map((m) => resolveImport(file, m[1])).filter((p): p is string => p !== null);
}

const files = Object.keys(SOURCES);
const gameOf = (path: string): string | null => (path.startsWith('games/') ? path.split('/')[1] : null);

describe('Arquitectura', () => {
  it('ningún minijuego importa código de otro (GAME-015)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const own = gameOf(file.slice(ROOT.length));
      if (!own) continue;
      for (const target of importsOf(file)) {
        const other = gameOf(target);
        if (other && other !== own) violations.push(`${file} → ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('el núcleo no importa ningún juego', () => {
    const violations = files
      .filter((f) => f.startsWith(`${ROOT}core/`))
      .flatMap((f) => importsOf(f).filter((t) => t.startsWith('games/')).map((t) => `${f} → ${t}`));
    expect(violations).toEqual([]);
  });

  it('las skins no tienen lógica propia en los juegos (sin `skin === "poio"`)', () => {
    const offenders = files.filter((f) => f.startsWith(`${ROOT}games/`) && /===\s*['"](poio|marcus)['"]/.test(SOURCES[f]));
    expect(offenders).toEqual([]);
  });

  it('comprueba de verdad los dos juegos', () => {
    const games = new Set(files.map((f) => gameOf(f.slice(ROOT.length))).filter(Boolean));
    expect(games.has('togas-walking-arround')).toBe(true);
    expect(games.has('togas-silent-class')).toBe(true);
  });
});
