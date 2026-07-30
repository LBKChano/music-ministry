export type RefreshTask = () => Promise<unknown>;

export class RefreshCoordinator {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    let operation: Promise<T>;
    try {
      operation = task();
    } catch (error) {
      operation = Promise.reject(error);
    }

    const promise = operation
      .finally(() => {
        if (this.inFlight.get(key) === promise) {
          this.inFlight.delete(key);
        }
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  isRefreshing(key?: string): boolean {
    return key ? this.inFlight.has(key) : this.inFlight.size > 0;
  }
}

export class RefreshBatchError extends Error {
  readonly failures: unknown[];

  constructor(failures: unknown[]) {
    super('Some information could not be refreshed. Pull down to try again.');
    this.name = 'RefreshBatchError';
    this.failures = failures;
  }
}

export async function runRefreshBatch(tasks: RefreshTask[]): Promise<void> {
  const results = await Promise.allSettled(tasks.map(task => task()));
  const failures = results.flatMap(result => (
    result.status === 'rejected' ? [result.reason] : []
  ));

  if (failures.length > 0) {
    throw new RefreshBatchError(failures);
  }
}

export function shouldShowInitialLoader(
  initializing: boolean,
  hasUsableData: boolean,
): boolean {
  return initializing && !hasUsableData;
}
