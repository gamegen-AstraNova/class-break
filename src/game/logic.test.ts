import { describe, expect, it } from 'vitest';
import { LESSON } from '../config/game';
import {
  accumulateScore,
  allClassmatesAreSlacking,
  allStudentsAreSlacking,
  classmateFollowChance,
  clamp,
  formatSeconds,
  nextTeacherPosition,
  nextHighScore,
  scoreRate,
  shouldTeacherPause,
  shouldTeacherTurn,
} from './logic';

describe('Class Break game rules', () => {
  it('gives the player one second to recover after the teacher faces the class', () => {
    expect(LESSON.teacherReactionMs).toBe(1_000);
  });

  it('accelerates continuous hold score and respects its cap', () => {
    expect(scoreRate(0)).toBe(80);
    expect(scoreRate(2_000)).toBe(140);
    expect(scoreRate(120_000)).toBe(LESSON.scoreRateCap);
  });

  it('keeps accumulating total score after the win target is reached', () => {
    expect(accumulateScore(LESSON.targetScore, 120_000, 1_000)).toBe(
      LESSON.targetScore + LESSON.scoreRateCap,
    );
  });

  it('keeps a normalized high score for future ranking data', () => {
    expect(nextHighScore(12_000, 14_500)).toBe(14_500);
    expect(nextHighScore(14_500, 12_000)).toBe(14_500);
    expect(nextHighScore(Number.NaN, 1_234.6)).toBe(1_235);
  });

  it('makes classmates increasingly likely to follow a longer player hold', () => {
    expect(classmateFollowChance(0)).toBe(LESSON.classmateFollowBaseChance);
    expect(classmateFollowChance(4_000)).toBeCloseTo(0.115);
    expect(classmateFollowChance(120_000)).toBe(LESSON.classmateFollowChanceCap);
  });

  it('formats the countdown without producing negative values', () => {
    expect(LESSON.durationMs).toBe(60_000);
    expect(formatSeconds(LESSON.durationMs)).toBe('60');
    expect(formatSeconds(501)).toBe('01');
    expect(formatSeconds(-1)).toBe('00');
  });

  it('clamps values to the configured range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it('keeps every fake-action walk on the blackboard and visibly changes position', () => {
    expect(nextTeacherPosition(50, 0)).toBe(32);
    expect(nextTeacherPosition(50, 1)).toBe(68);
    expect(Math.abs(nextTeacherPosition(50, 0.5) - 50)).toBeGreaterThanOrEqual(12);
  });

  it('uses the configured probability to choose a real turn', () => {
    expect(shouldTeacherTurn(LESSON.teacherTurnChance - 0.01)).toBe(true);
    expect(shouldTeacherTurn(LESSON.teacherTurnChance)).toBe(false);
  });

  it('usually keeps walking and only occasionally pauses', () => {
    expect(shouldTeacherPause(LESSON.teacherPauseChance - 0.01)).toBe(true);
    expect(shouldTeacherPause(LESSON.teacherPauseChance)).toBe(false);
    expect(LESSON.teacherPauseChance).toBe(0.25);
  });

  it('pauses for exactly two seconds before choosing the next teacher action', () => {
    expect(LESSON.teacherPauseMs).toBe(2_000);
  });

  it('tracks whether the player has joined both slacking classmates', () => {
    expect(allClassmatesAreSlacking(2)).toBe(true);
    expect(allClassmatesAreSlacking(1)).toBe(false);
    expect(allStudentsAreSlacking(true, 2)).toBe(true);
    expect(allStudentsAreSlacking(true, 1)).toBe(false);
    expect(allStudentsAreSlacking(false, 2)).toBe(false);
    expect(LESSON.classroomAttentionMs).toBe(5_000);
  });
});
