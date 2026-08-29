import { describe, expect, it } from 'vitest';
import {
  buildAssetCandidates,
  buildLocaleCandidates,
  normalizeBase,
  sanitizeStyleBase,
} from './assets';
import { ASSET_PATHS } from '../config/assets';
import { AUDIO_VOLUME } from '../config/audio';

describe('GameGen asset fallback', () => {
  it('keeps calibrated playback volumes in one complete audio table', () => {
    expect(AUDIO_VOLUME).toEqual({
      bgm_classroom_loop: 0.12,
      sfx_ui_click: 0.65,
      sfx_teacher_walk_loop: 0.5,
      sfx_teacher_write_loop: 0.55,
      sfx_warning: 0.5,
      sfx_caught: 0.45,
      sfx_win: 0.45,
    });
  });

  it('registers the classroom BGM under the audio asset path', () => {
    expect(ASSET_PATHS.bgm_classroom_loop).toBe('audio/bgm_classroom_loop.mp3');
  });

  it('registers the shared UI click sound under the audio asset path', () => {
    expect(ASSET_PATHS.sfx_ui_click).toBe('audio/sfx_ui_click.mp3');
  });

  it('registers both teacher activity loops under audio asset paths', () => {
    expect(ASSET_PATHS.sfx_teacher_walk_loop).toBe('audio/sfx_teacher_walk_loop.mp3');
    expect(ASSET_PATHS.sfx_teacher_write_loop).toBe('audio/sfx_teacher_write_loop.mp3');
  });

  it('registers three distinct CG outcomes for every playable character', () => {
    const resultCgKeys = Object.keys(ASSET_PATHS).filter((key) =>
      /^bg_(asteria|nyx|lumi)_(caught|timeup|win)$/.test(key),
    );
    expect(resultCgKeys).toHaveLength(9);
  });

  it('normalizes every configured base to one trailing slash', () => {
    expect(normalizeBase('https://cdn.example/game///')).toBe('https://cdn.example/game/');
    expect(normalizeBase('')).toBe('');
  });

  it('rejects unsafe style protocols and resolves safe relative roots', () => {
    expect(sanitizeStyleBase('javascript:alert(1)', 'https://game.example/play/')).toBe('');
    expect(sanitizeStyleBase('../skin', 'https://game.example/play/')).toBe(
      'https://game.example/skin/',
    );
  });

  it('keeps the required fallback order for every asset', () => {
    expect(
      buildAssetCandidates(
        'textures/bg_classroom.png',
        'https://style.example/skin/',
        'https://cdn.example/common/',
        './',
      ),
    ).toEqual([
      'https://style.example/skin/textures/bg_classroom.png',
      'https://cdn.example/common/textures/bg_classroom.png',
      './common/textures/bg_classroom.png',
      './textures/bg_classroom.png',
    ]);
  });

  it('uses style and commonPath before the local language file', () => {
    expect(
      buildLocaleCandidates(
        'config/language/ja.json',
        'https://style.example/skin/',
        'https://cdn.example/common/',
        './',
      ),
    ).toEqual([
      'https://style.example/skin/config/language/ja.json',
      'https://cdn.example/common/config/language/ja.json',
      './config/language/ja.json',
    ]);
  });
});
