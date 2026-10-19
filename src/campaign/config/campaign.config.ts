/** Datos generales del modo campaña. */
export const CAMPAIGN_CONFIG = {
  id: 'togas-campaign',
  title: 'Togas: Campaña',
  version: '0.1.0',
  description: 'Aventura narrativa con misiones encadenadas, puntos que se arrastran de nivel en nivel y personajes por desbloquear.',
  motto: 'Ocho humanos corrientes. Veinticuatro misiones ridículas. Un universo que necesita desesperadamente ser salvado.',
} as const;

/**
 * Narración de apertura (spec 2.1), por "pantallas". `roster: true` muestra las ocho
 * siluetas con Pollo destacado.
 */
export const OPENING_NARRATION: ReadonlyArray<{ text: string; roster?: boolean; aside?: boolean }> = [
  { text: 'El destino ha elegido a ocho humanos con habilidades extraordinarias para mantener el orden en el universo.' },
  { text: '¿A quién queremos engañar?', aside: true },
  { text: 'Nuestros héroes no tienen absolutamente ninguna habilidad extraordinaria. Son simples humanos, equipados con las capacidades más humanas imaginables.' },
  { text: 'El destino es impredecible, sin duda. Pero quizá, esta vez, necesitaba gente corriente cuyas habilidades naturales han sido reprimidas por las miserables y tiránicas normas de buena educación impuestas por un puñado de aristócratas.' },
  { text: 'Los aristócratas: quizá el clan social más absurdo, problemático e insufrible que ha conocido la humanidad.' },
  { text: 'Ocho héroes. Ocho talentos cuestionables. Un universo que salvar.', roster: true },
  { text: 'Bienvenido al Modo Campaña de Togas.' },
];

/** Por qué ha fallado una misión, en palabras del jugador. */
export const FAILURE_REASONS: Readonly<Record<string, string>> = {
  arrested: 'Detenido por la policía: cinco estrellas de búsqueda.',
  noPoints: 'Llegaste a la universidad, pero sin puntos de campaña.',
  caught: 'El profe te pilló soltándolo mientras miraba a la clase.',
  fallen: 'Tres caídas de la silla: expulsión inmediata.',
  bankrupt: 'Te quedaste sin puntos de campaña.',
  interrupted: 'La misión se interrumpió antes de terminar.',
};
