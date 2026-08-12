export const SPLASH_BACKGROUND_COLOR = '#091C35';

export const SPLASH_TIMING = {
  brandPulse: 640,
  exit: 240,
  minimumVisible: 720,
  statusDelay: 1100,
  titleDelay: 120,
  titleReveal: 420,
} as const;

export function getSplashMarkSize(width: number, height: number): number {
  const availableSize = Math.min(width * 0.64, height * 0.34);
  return Math.round(Math.min(276, Math.max(218, availableSize)));
}

export function getSplashExitDelay(
  mountedAt: number,
  now: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return 0;
  return Math.max(0, SPLASH_TIMING.minimumVisible - (now - mountedAt));
}
