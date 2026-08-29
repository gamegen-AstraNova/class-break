import { ASSET_PATHS, ASSET_REVISIONS, type AssetKey, type AssetMap } from '../config/assets';

interface GeneralConfiguration {
  isLocal?: boolean;
  commonPath?: string;
}

export interface RuntimeBases {
  appBase: string;
  styleBase: string;
  commonPath: string;
}

const TRANSPARENT_FALLBACK =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const SILENT_AUDIO_FALLBACK =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export function normalizeBase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `${trimmed.replace(/\/+$/, '')}/`;
}

export function sanitizeStyleBase(value: string, pageUrl: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const resolved = new URL(trimmed, pageUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return '';
    return normalizeBase(resolved.href);
  } catch {
    return '';
  }
}

function joinBase(base: string, relativePath: string): string {
  return `${normalizeBase(base)}${relativePath.replace(/^\/+/, '')}`;
}

function appendRevision(url: string, revision?: string): string {
  if (!revision) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(revision)}`;
}

export function buildAssetCandidates(
  relativePath: string,
  styleBase: string,
  commonPath: string,
  appBase: string,
): string[] {
  const candidates = [
    styleBase ? joinBase(styleBase, relativePath) : '',
    commonPath ? joinBase(commonPath, relativePath) : '',
    joinBase(`${appBase}common/`, relativePath),
    joinBase(appBase, relativePath),
  ].filter(Boolean);
  return [...new Set(candidates)];
}

export function buildLocaleCandidates(
  relativePath: string,
  styleBase: string,
  commonPath: string,
  appBase: string,
): string[] {
  return [
    styleBase ? joinBase(styleBase, relativePath) : '',
    commonPath ? joinBase(commonPath, relativePath) : '',
    joinBase(appBase, relativePath),
  ].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
}

function probeImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error(`Image failed: ${url}`));
    image.src = url;
  });
}

async function loadImage(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    try {
      return await probeImage(candidate);
    } catch {
      // Each asset independently advances to its next configured fallback.
    }
  }
  console.warn('Class Break asset fallback exhausted', candidates);
  return TRANSPARENT_FALLBACK;
}

function probeAudio(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', loaded);
      audio.removeEventListener('error', failed);
    };
    const loaded = () => {
      cleanup();
      resolve(url);
    };
    const failed = () => {
      cleanup();
      reject(new Error(`Audio failed: ${url}`));
    };
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', loaded, { once: true });
    audio.addEventListener('error', failed, { once: true });
    audio.src = url;
    audio.load();
  });
}

async function loadAudio(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    try {
      return await probeAudio(candidate);
    } catch {
      // Each asset independently advances to its next configured fallback.
    }
  }
  console.warn('Class Break audio fallback exhausted', candidates);
  return SILENT_AUDIO_FALLBACK;
}

async function loadGeneralConfiguration(appBase: string): Promise<GeneralConfiguration> {
  try {
    const response = await fetch(joinBase(appBase, 'config/generalConfiguration.json'));
    if (!response.ok) return {};
    return (await response.json()) as GeneralConfiguration;
  } catch {
    return {};
  }
}

let runtimeBasesPromise: Promise<RuntimeBases> | null = null;

export function resolveRuntimeBases(): Promise<RuntimeBases> {
  if (!runtimeBasesPromise) {
    runtimeBasesPromise = (async () => {
      const appBase = normalizeBase(import.meta.env.BASE_URL || './');
      const styleBase = sanitizeStyleBase(
        new URLSearchParams(window.location.search).get('style') ?? '',
        window.location.href,
      );
      const general = await loadGeneralConfiguration(appBase);
      return {
        appBase,
        styleBase,
        commonPath: normalizeBase(general.commonPath ?? ''),
      };
    })();
  }
  return runtimeBasesPromise;
}

export async function loadAssets(
  onProgress: (loaded: number, total: number) => void,
): Promise<AssetMap> {
  const { appBase, styleBase, commonPath } = await resolveRuntimeBases();
  const entries = Object.entries(ASSET_PATHS) as [AssetKey, string][];
  let loaded = 0;

  const resolvedEntries = await Promise.all(
    entries.map(async ([key, relativePath]) => {
      const candidates = buildAssetCandidates(relativePath, styleBase, commonPath, appBase).map(
        (candidate) => appendRevision(candidate, ASSET_REVISIONS[key]),
      );
      const url = relativePath.startsWith('audio/')
        ? await loadAudio(candidates)
        : await loadImage(candidates);
      loaded += 1;
      onProgress(loaded, entries.length);
      return [key, url] as const;
    }),
  );

  return Object.fromEntries(resolvedEntries) as AssetMap;
}
