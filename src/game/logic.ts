import {
  CHARACTERS,
  LESSON,
  STUDENT_SEAT_POSITIONS,
  type CharacterId,
} from '../config/game';

export type TeacherPhase = 'writing' | 'warning' | 'watching';
export type FormulaAnchor = 'start' | 'center' | 'end';
export const RESULT_KINDS = ['caught', 'timeup', 'win'] as const;
export type ResultKind = (typeof RESULT_KINDS)[number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreRate(holdMs: number): number {
  const accelerated =
    LESSON.scoreBasePerSecond +
    LESSON.scoreAccelerationPerSecond * (holdMs / 1_000);
  return Math.min(LESSON.scoreRateCap, accelerated);
}

export function accumulateScore(
  currentScore: number,
  holdMs: number,
  deltaMs: number,
): number {
  return Math.max(0, currentScore)
    + (scoreRate(holdMs) * Math.max(0, deltaMs)) / 1_000;
}

export function nextHighScore(previousScore: number, latestScore: number): number {
  const normalizedPrevious = Number.isFinite(previousScore)
    ? Math.max(0, Math.round(previousScore))
    : 0;
  const normalizedLatest = Number.isFinite(latestScore)
    ? Math.max(0, Math.round(latestScore))
    : 0;
  return Math.max(normalizedPrevious, normalizedLatest);
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function assignStudentSeatPositions(
  player: CharacterId,
  randomValue = Math.random(),
): Record<CharacterId, number> {
  const classmates = CHARACTERS.filter((character) => character !== player);
  const [left, right] = randomValue < 0.5 ? classmates : [classmates[1], classmates[0]];
  return {
    [left]: STUDENT_SEAT_POSITIONS.left,
    [player]: STUDENT_SEAT_POSITIONS.center,
    [right]: STUDENT_SEAT_POSITIONS.right,
  } as Record<CharacterId, number>;
}

export function nextTeacherPosition(
  current: number,
  randomValue = Math.random(),
  min: number = LESSON.teacherPositionMin,
  max: number = LESSON.teacherPositionMax,
): number {
  const candidate = min + clamp(randomValue, 0, 1) * (max - min);
  const minimumTravel = Math.min(12, (max - min) / 2);
  if (Math.abs(candidate - current) >= minimumTravel) return candidate;
  return current <= (min + max) / 2
    ? Math.min(max, current + minimumTravel)
    : Math.max(min, current - minimumTravel);
}

export function formulaPlacementForTeacher(
  teacherPosition: number,
  min: number,
  max: number,
): { position: number; anchor: FormulaAnchor } {
  const position = clamp(teacherPosition, min, max);
  const range = Math.max(1, max - min);
  const positionRatio = (position - min) / range;
  return {
    position,
    anchor: positionRatio < 1 / 3
      ? 'start'
      : positionRatio > 2 / 3 ? 'end' : 'center',
  };
}

export function shouldTeacherTurn(randomValue = Math.random()): boolean {
  return randomValue < LESSON.teacherTurnChance;
}

export function shouldTeacherPause(randomValue = Math.random()): boolean {
  return randomValue < LESSON.teacherPauseChance;
}

export function classmateFollowChance(holdMs: number): number {
  return Math.min(
    LESSON.classmateFollowChanceCap,
    LESSON.classmateFollowBaseChance
      + LESSON.classmateFollowChancePerSecond * (Math.max(0, holdMs) / 1_000),
  );
}

export function allStudentsAreSlacking(
  playerHolding: boolean,
  slackingClassmateCount: number,
): boolean {
  return playerHolding && allClassmatesAreSlacking(slackingClassmateCount);
}

export function allClassmatesAreSlacking(slackingClassmateCount: number): boolean {
  return slackingClassmateCount === CHARACTERS.length - 1;
}

export function formatSeconds(remainingMs: number): string {
  return Math.max(0, Math.ceil(remainingMs / 1_000)).toString().padStart(2, '0');
}
