import { Platform } from 'react-native';

export type PerformanceBaselineScreen = 'Schedules' | 'Church' | 'Profile';

type BaselineDetails = Record<string, boolean | number | string | null>;

type RequestRecord = {
  id: number;
  visitId: number | null;
  method: string;
  endpoint: string;
  startedAtMs: number;
  durationMs: number | null;
  status: number | null;
  succeeded: boolean | null;
};

type VisitRecord = {
  id: number;
  screen: PerformanceBaselineScreen;
  visitNumber: number;
  kind: 'first' | 'return';
  startedAtMs: number;
  endedAtMs: number | null;
  readySignaledAtMs: number | null;
  readyAtMs: number | null;
  renderCount: number;
  details: BaselineDetails;
};

type RequestToken = Pick<RequestRecord, 'id' | 'visitId'>;

const now = () => globalThis.performance?.now?.() ?? Date.now();
const round = (value: number) => Math.round(value * 10) / 10;
const READY_NETWORK_QUIET_MS = 250;

export const performanceBaselineEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_PERFORMANCE_BASELINE === '1';

const deviceLabel =
  process.env.EXPO_PUBLIC_PERFORMANCE_DEVICE_LABEL?.trim() || `${Platform.OS}-local`;

function sanitizeEndpoint(input: Parameters<typeof fetch>[0]): string {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : typeof input === 'object' && input && 'url' in input
          ? String(input.url)
          : 'unknown';

  try {
    return new URL(rawUrl).pathname;
  } catch {
    return rawUrl.split('?')[0] || 'unknown';
  }
}

function requestMethod(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && input && 'method' in input) {
    return String(input.method).toUpperCase();
  }
  return 'GET';
}

class PerformanceBaselineRecorder {
  private startedAt = new Date().toISOString();
  private nextVisitId = 1;
  private nextRequestId = 1;
  private activeVisitId: number | null = null;
  private visits: VisitRecord[] = [];
  private requests: RequestRecord[] = [];
  private readyTimers = new Map<number, ReturnType<typeof setTimeout>>();

  startVisit(screen: PerformanceBaselineScreen): number | null {
    if (!performanceBaselineEnabled) return null;

    if (this.activeVisitId !== null) {
      this.endVisit(this.activeVisitId, false);
    }

    const visitNumber = this.visits.filter(visit => visit.screen === screen).length + 1;
    const visit: VisitRecord = {
      id: this.nextVisitId++,
      screen,
      visitNumber,
      kind: visitNumber === 1 ? 'first' : 'return',
      startedAtMs: now(),
      endedAtMs: null,
      readySignaledAtMs: null,
      readyAtMs: null,
      renderCount: 0,
      details: {},
    };

    this.visits.push(visit);
    for (const request of this.requests) {
      if (request.visitId === null && request.durationMs === null) {
        request.visitId = visit.id;
      }
    }
    this.activeVisitId = visit.id;
    console.info(
      `[PerfBaseline] ${deviceLabel}: started ${screen} ${visit.kind} visit #${visitNumber}`
    );
    return visit.id;
  }

  endVisit(visitId: number | null, print = true): void {
    if (!performanceBaselineEnabled || visitId === null) return;

    const visit = this.visits.find(item => item.id === visitId);
    if (!visit || visit.endedAtMs !== null) return;

    this.clearReadyTimer(visit.id);
    visit.endedAtMs = now();
    if (this.activeVisitId === visitId) this.activeVisitId = null;

    if (print) {
      console.info('[PerfBaseline] Visit complete', this.summarizeVisit(visit));
    }
  }

  recordRender(screen: PerformanceBaselineScreen): void {
    if (!performanceBaselineEnabled) return;
    const visit = this.getActiveVisit();
    if (visit?.screen === screen) visit.renderCount += 1;
  }

  markReady(screen: PerformanceBaselineScreen, details: BaselineDetails): void {
    if (!performanceBaselineEnabled) return;
    const visit = this.getActiveVisit();
    if (!visit || visit.screen !== screen || visit.readyAtMs !== null) return;

    visit.readySignaledAtMs ??= now();
    visit.details = { ...details };
    this.scheduleReadyWhenIdle(visit);
  }

  beginRequest(method: string, endpoint: string): RequestToken | null {
    if (!performanceBaselineEnabled) return null;

    const request: RequestRecord = {
      id: this.nextRequestId++,
      visitId: this.activeVisitId,
      method,
      endpoint,
      startedAtMs: now(),
      durationMs: null,
      status: null,
      succeeded: null,
    };
    this.requests.push(request);
    if (request.visitId !== null) this.clearReadyTimer(request.visitId);
    return { id: request.id, visitId: request.visitId };
  }

  finishRequest(token: RequestToken | null, status: number | null, succeeded: boolean): void {
    if (!performanceBaselineEnabled || token === null) return;
    const request = this.requests.find(item => item.id === token.id);
    if (!request) return;

    if (request.visitId === null && this.activeVisitId !== null) {
      request.visitId = this.activeVisitId;
    }
    request.durationMs = round(now() - request.startedAtMs);
    request.status = status;
    request.succeeded = succeeded;

    if (request.visitId !== null) {
      const visit = this.visits.find(item => item.id === request.visitId);
      if (visit) this.scheduleReadyWhenIdle(visit);
    }
  }

  reset(): void {
    this.startedAt = new Date().toISOString();
    this.nextVisitId = 1;
    this.nextRequestId = 1;
    this.activeVisitId = null;
    for (const timer of this.readyTimers.values()) clearTimeout(timer);
    this.readyTimers.clear();
    this.visits = [];
    this.requests = [];
    console.info(`[PerfBaseline] ${deviceLabel}: measurements reset`);
  }

  getReport() {
    return {
      schemaVersion: 1,
      startedAt: this.startedAt,
      capturedAt: new Date().toISOString(),
      deviceLabel,
      platform: Platform.OS,
      visits: this.visits.map(visit => this.summarizeVisit(visit)),
      startupOrUnscopedRequests: this.summarizeRequests(
        this.requests.filter(request => request.visitId === null)
      ),
    };
  }

  printReport(): void {
    console.info('[PerfBaseline:Report]\n' + JSON.stringify(this.getReport(), null, 2));
  }

  private getActiveVisit(): VisitRecord | undefined {
    return this.visits.find(visit => visit.id === this.activeVisitId);
  }

  private clearReadyTimer(visitId: number): void {
    const timer = this.readyTimers.get(visitId);
    if (timer) clearTimeout(timer);
    this.readyTimers.delete(visitId);
  }

  private scheduleReadyWhenIdle(visit: VisitRecord): void {
    if (
      visit.readySignaledAtMs === null ||
      visit.readyAtMs !== null ||
      visit.endedAtMs !== null
    ) {
      return;
    }

    this.clearReadyTimer(visit.id);
    const pendingRequests = this.requests.some(
      request => request.visitId === visit.id && request.durationMs === null
    );
    if (pendingRequests) return;

    const timer = setTimeout(() => {
      this.readyTimers.delete(visit.id);
      const stillPending = this.requests.some(
        request => request.visitId === visit.id && request.durationMs === null
      );
      if (stillPending || visit.endedAtMs !== null || visit.readyAtMs !== null) return;

      visit.readyAtMs = now();
      console.info(
        `[PerfBaseline] ${deviceLabel}: ${visit.screen} ready in ${round(
          visit.readyAtMs - visit.startedAtMs
        )}ms`
      );
    }, READY_NETWORK_QUIET_MS);

    this.readyTimers.set(visit.id, timer);
  }

  private summarizeVisit(visit: VisitRecord) {
    const end = visit.endedAtMs ?? now();
    const visitRequests = this.requests.filter(request => request.visitId === visit.id);
    return {
      screen: visit.screen,
      visitNumber: visit.visitNumber,
      kind: visit.kind,
      durationMs: round(end - visit.startedAtMs),
      loadTimeMs:
        visit.readyAtMs === null ? null : round(visit.readyAtMs - visit.startedAtMs),
      renderCount: visit.renderCount,
      ready: visit.readyAtMs !== null,
      details: visit.details,
      requests: this.summarizeRequests(visitRequests),
    };
  }

  private summarizeRequests(requests: RequestRecord[]) {
    const endpoints = new Map<
      string,
      { count: number; errors: number; totalDurationMs: number }
    >();

    for (const request of requests) {
      const key = `${request.method} ${request.endpoint}`;
      const entry = endpoints.get(key) ?? { count: 0, errors: 0, totalDurationMs: 0 };
      entry.count += 1;
      if (request.succeeded === false) entry.errors += 1;
      entry.totalDurationMs += request.durationMs ?? 0;
      endpoints.set(key, entry);
    }

    return {
      count: requests.length,
      completed: requests.filter(request => request.durationMs !== null).length,
      errors: requests.filter(request => request.succeeded === false).length,
      totalDurationMs: round(
        requests.reduce((total, request) => total + (request.durationMs ?? 0), 0)
      ),
      endpoints: [...endpoints.entries()]
        .map(([endpoint, values]) => ({
          endpoint,
          count: values.count,
          errors: values.errors,
          totalDurationMs: round(values.totalDurationMs),
        }))
        .sort((a, b) => a.endpoint.localeCompare(b.endpoint)),
    };
  }
}

declare global {
  // Exposed only in development baseline runs for use from the JavaScript console.
  // eslint-disable-next-line no-var
  var __musicMinistryPerformanceBaselineRecorder:
    | PerformanceBaselineRecorder
    | undefined;
  // eslint-disable-next-line no-var
  var musicMinistryPerformanceBaseline:
    | {
        reset: () => void;
        report: () => ReturnType<PerformanceBaselineRecorder['getReport']>;
        printReport: () => void;
      }
    | undefined;
}

export const performanceBaseline =
  globalThis.__musicMinistryPerformanceBaselineRecorder ??
  new PerformanceBaselineRecorder();

if (performanceBaselineEnabled) {
  globalThis.__musicMinistryPerformanceBaselineRecorder = performanceBaseline;
  globalThis.musicMinistryPerformanceBaseline = {
    reset: () => performanceBaseline.reset(),
    report: () => performanceBaseline.getReport(),
    printReport: () => performanceBaseline.printReport(),
  };
}

export const performanceSupabaseFetch: typeof fetch = async (...args) => {
  if (!performanceBaselineEnabled) return fetch(...args);

  const token = performanceBaseline.beginRequest(
    requestMethod(args[0], args[1]),
    sanitizeEndpoint(args[0])
  );

  try {
    const response = await fetch(...args);
    performanceBaseline.finishRequest(token, response.status, response.ok);
    return response;
  } catch (error) {
    performanceBaseline.finishRequest(token, null, false);
    throw error;
  }
};
