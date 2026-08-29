export const CHARACTERS = ['asteria', 'nyx', 'lumi'] as const;
export type CharacterId = (typeof CHARACTERS)[number];

export const STUDENT_SEAT_POSITIONS = {
  left: 24,
  center: 50,
  right: 76,
} as const;

export const LESSON = {
  id: 'homeroom',
  durationMs: 60_000,
  targetScore: 8_000,
  teacherWalkMinMs: 1_800,
  teacherWalkMaxMs: 3_200,
  teacherPauseChance: 0.25,
  teacherPauseMs: 2_000,
  teacherPositionMin: 32,
  teacherPositionMax: 68,
  teacherNarrowPositionMin: 44,
  teacherNarrowPositionMax: 56,
  teacherTurnChance: 0.62,
  boardFormulaLimit: 3,
  classmateFollowIntervalMs: 800,
  classmateFollowBaseChance: 0.015,
  classmateFollowChancePerSecond: 0.025,
  classmateFollowChanceCap: 0.35,
  classroomAttentionMs: 5_000,
  teacherReactionMs: 1_000,
  watchingMinMs: 1_700,
  watchingMaxMs: 2_700,
  scoreBasePerSecond: 80,
  scoreAccelerationPerSecond: 30,
  scoreRateCap: 260,
} as const;

export const BLACKBOARD_FORMULAS = [
  '2x + 5 = 17',
  'a² + b² = c²',
  '3y − 7 = 11',
  '√144 = 12',
  'πr²',
  'E = mc²',
  '7 × 8 = 56',
  'x² − 4x + 3',
  'sin²θ + cos²θ = 1',
  'Δ = b² − 4ac',
  '∫₀¹ x²dx = ⅓',
  'Σn = n(n + 1) ÷ 2',
  'GameGen.diy',
  'AstraNova',
  '↑↑↓↓←→←→BA',
] as const;

export const STORAGE_KEYS = {
  locale: 'class-break.locale',
  unlocked: 'class-break.unlocked-cg',
  highScore: 'class-break.high-score',
  bgm: 'class-break.bgm-enabled',
  sfx: 'class-break.sfx-enabled',
} as const;
