export type ChurchSetupPresentation = 'guided' | 'compact' | 'expanded';

export function resolveChurchSetupPresentation({
  setupReady,
  expanded,
}: {
  setupReady: boolean;
  expanded: boolean;
}): ChurchSetupPresentation {
  if (!setupReady) return 'guided';
  return expanded ? 'expanded' : 'compact';
}
