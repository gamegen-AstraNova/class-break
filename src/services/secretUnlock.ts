import { CHARACTERS } from '../config/game';
import { RESULT_KINDS } from '../game/logic';

export const SECRET_HOLD_DURATION_MS = 1_800;
export const SECRET_TRIGGER_CORNER_PX = 96;
export const SECRET_POINTER_TOLERANCE_PX = 16;
export const ALL_CG_IDS = CHARACTERS.flatMap((student) =>
  RESULT_KINDS.map((result) => `${student}_${result}`),
);

const SECRET_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

export interface SecretSequenceResult {
  completed: boolean;
  nextIndex: number;
}

export function isSecretTriggerCorner(x: number, y: number): boolean {
  return x >= 0 && y >= 0
    && x <= SECRET_TRIGGER_CORNER_PX && y <= SECRET_TRIGGER_CORNER_PX;
}

export function advanceSecretSequence(
  currentIndex: number,
  key: string,
): SecretSequenceResult {
  const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
  if (normalizedKey === SECRET_CODE[currentIndex]) {
    const nextIndex = currentIndex + 1;
    return nextIndex === SECRET_CODE.length
      ? { completed: true, nextIndex: 0 }
      : { completed: false, nextIndex };
  }

  return {
    completed: false,
    nextIndex: normalizedKey === SECRET_CODE[0] ? 1 : 0,
  };
}
