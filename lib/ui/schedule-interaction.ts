export const SCHEDULE_MINIMUM_TARGET_SIZE = 44;
export const SCHEDULE_DISCLOSURE_ANIMATION_MS = 160;

export function shouldAnimateScheduleDisclosure(
  reduceMotionEnabled: boolean,
): boolean {
  return !reduceMotionEnabled;
}
