import { describe, expect, it } from 'vitest';
import {
  ALL_CG_IDS,
  advanceSecretSequence,
  isSecretTriggerCorner,
  SECRET_HOLD_DURATION_MS,
  SECRET_POINTER_TOLERANCE_PX,
  SECRET_TRIGGER_CORNER_PX,
  type SecretSequenceResult,
} from './secretUnlock';

function enterSequence(keys: string[]): SecretSequenceResult {
  return keys.reduce<SecretSequenceResult>(
    (state, key) => advanceSecretSequence(state.nextIndex, key),
    { completed: false, nextIndex: 0 },
  );
}

describe('secret CG unlock', () => {
  it('contains every character and result combination exactly once', () => {
    expect(ALL_CG_IDS).toHaveLength(9);
    expect(new Set(ALL_CG_IDS).size).toBe(9);
    expect(ALL_CG_IDS).toEqual([
      'asteria_caught', 'asteria_timeup', 'asteria_win',
      'nyx_caught', 'nyx_timeup', 'nyx_win',
      'lumi_caught', 'lumi_timeup', 'lumi_win',
    ]);
  });

  it('uses the AstraNova mobile top-left hold target', () => {
    expect(SECRET_TRIGGER_CORNER_PX).toBe(96);
    expect(SECRET_HOLD_DURATION_MS).toBe(1_800);
    expect(SECRET_POINTER_TOLERANCE_PX).toBe(16);
    expect(isSecretTriggerCorner(0, 0)).toBe(true);
    expect(isSecretTriggerCorner(96, 96)).toBe(true);
    expect(isSecretTriggerCorner(97, 96)).toBe(false);
    expect(isSecretTriggerCorner(96, -1)).toBe(false);
  });

  it('completes the keyboard sequence case-insensitively and resets', () => {
    expect(enterSequence([
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'B', 'a',
    ])).toEqual({ completed: true, nextIndex: 0 });
  });

  it('recovers when a mismatch is also the start of a new sequence', () => {
    let state = enterSequence(['ArrowUp', 'ArrowDown']);
    expect(state).toEqual({ completed: false, nextIndex: 0 });
    state = advanceSecretSequence(state.nextIndex, 'ArrowUp');
    expect(state).toEqual({ completed: false, nextIndex: 1 });
  });
});
