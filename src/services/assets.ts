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
const ASSET_LOAD_CONCURRENCY = 8;
const ASSET_PROBE_TIMEOUT_MS = 12_000;
const preloadedAudioByUrl = new Map<string, HTMLAudioElement>();

type AssetKind = 'image' | 'audio' | 'font';

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

export function localCommonAssetUrl(relativePath: string): string {
  const appBase = normalizeBase(import.meta.env.BASE_URL || './');
  return joinBase(`${appBase}common/`, relativePath);
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
    let settled = false;
    const timeout = window.setTimeout(() => finish(false), ASSET_PROBE_TIMEOUT_MS);
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (!loaded) image.src = '';
      if (loaded) resolve(url);
      else reject(new Error(`Image failed: ${url}`));
    };
    image.onload = () => {
      void image.decode().catch(() => undefined).then(() => finish(true));
    };
    image.onerror = () => finish(false);
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
    let settled = false;
    const timeout = window.setTimeout(() => finish(false), ASSET_PROBE_TIMEOUT_MS);
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.oncanplaythrough = null;
      audio.onerror = null;
      if (loaded) {
        preloadedAudioByUrl.set(url, audio);
        resolve(url);
      } else {
        audio.removeAttribute('src');
        audio.load();
        reject(new Error(`Audio failed: ${url}`));
      }
    };
    audio.preload = 'auto';
    audio.oncanplaythrough = () => finish(true);
    audio.onerror = () => finish(false);
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

async function probeFont(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ASSET_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Font failed: ${url}`);
    const font = new FontFace('ChalkJP', await response.arrayBuffer());
    document.fonts.add(await font.load());
    return url;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadFont(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    try {
      return await probeFont(candidate);
    } catch {
      // Each font independently advances to its next configured fallback.
    }
  }
  console.warn('Class Break font fallback exhausted', candidates);
  return candidates.at(-1) ?? '';
}

function assetKind(relativePath: string): AssetKind {
  if (relativePath.startsWith('audio/')) return 'audio';
  if (relativePath.startsWith('fonts/')) return 'font';
  return 'image';
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function createPreloadedAudio(source: string): HTMLAudioElement {
  const template = preloadedAudioByUrl.get(source);
  const audio = template
    ? template.cloneNode(true) as HTMLAudioElement
    : new Audio(source);
  audio.preload = 'auto';
  return audio;
}

export async function primePreloadedAudio(): Promise<void> {
  const players = [...preloadedAudioByUrl.values()];
  const attempts = players.map((audio) => {
    audio.muted = true;
    audio.currentTime = 0;
    return audio.play().catch(() => undefined);
  });
  await Promise.all(attempts);
  players.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
  });
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

  const resolvedEntries = await mapWithConcurrency(
    entries,
    ASSET_LOAD_CONCURRENCY,
    async ([key, relativePath]) => {
      const candidates = buildAssetCandidates(relativePath, styleBase, commonPath, appBase).map(
        (candidate) => appendRevision(candidate, ASSET_REVISIONS[key]),
      );
      const kind = assetKind(relativePath);
      const url = kind === 'audio'
        ? await loadAudio(candidates)
        : kind === 'font'
          ? await loadFont(candidates)
          : await loadImage(candidates);
      loaded += 1;
      onProgress(loaded, entries.length);
      return [key, url] as const;
    },
  );

  return Object.fromEntries(resolvedEntries) as AssetMap;
}
