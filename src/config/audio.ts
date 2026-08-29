import type { AssetKey } from './assets';

type AudioAssetKey = Extract<AssetKey, `bgm_${string}` | `sfx_${string}`>;
export type SfxKey = Extract<AudioAssetKey, `sfx_${string}`>;

export const AUDIO_VOLUME = {
  bgm_classroom_loop: 0.12,
  sfx_ui_click: 0.65,
  sfx_teacher_walk_loop: 0.5,
  sfx_teacher_write_loop: 0.55,
  sfx_warning: 0.5,
  sfx_caught: 0.45,
  sfx_win: 0.45,
} as const satisfies Record<AudioAssetKey, number>;
