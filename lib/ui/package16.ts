export interface TabRouteLike {
  name: string;
  route: string;
}

export function findActiveTabIndex(
  pathname: string,
  tabs: readonly TabRouteLike[],
): number {
  let bestIndex = 0;
  let bestScore = -1;

  tabs.forEach((tab, index) => {
    const route = String(tab.route);
    let score = 0;

    if (pathname === route) {
      score = 100;
    } else if (pathname.startsWith(`${route}/`)) {
      score = 80;
    } else if (tab.name && pathname.includes(tab.name)) {
      score = 60;
    } else {
      const tabSegment = route.split('/(tabs)/')[1];
      if (tabSegment && pathname.includes(tabSegment)) score = 40;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function shouldDisplayAdminTab(
  sessionStatus: string,
  isAdmin: boolean,
): boolean {
  return sessionStatus === 'ready' && isAdmin;
}

export function shouldLeaveChurchTab({
  pathname,
  sessionStatus,
  isAdmin,
}: {
  pathname: string;
  sessionStatus: string;
  isAdmin: boolean;
}): boolean {
  return (
    sessionStatus === 'ready'
    && !isAdmin
    && pathname.includes('/church')
  );
}

const TECHNICAL_ERROR_PATTERN = new RegExp([
  '\\b(?:PGRST\\d+|JWT|RPC|auth\\.uid|service[_ -]?role|OneSignal|Supabase)\\b',
  '\\b(?:22P02|23503|23505|42501|42P01)\\b',
  '\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b',
].join('|'), 'i');

export function sanitizeUserFacingMessage(
  message: string,
  tone: 'success' | 'error' | 'info',
): string {
  const normalized = message.trim();
  if (!normalized) return '';
  if (tone !== 'error' || !TECHNICAL_ERROR_PATTERN.test(normalized)) {
    return normalized;
  }

  return 'We could not complete that action. Check your connection and try again.';
}
