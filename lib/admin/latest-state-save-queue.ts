export type LatestStateSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type LatestStateSaveQueueOptions<T> = {
  initialConfirmed: T;
  persist: (value: T) => Promise<T>;
  onOptimistic: (value: T) => void;
  onConfirmed: (value: T) => void;
  onRollback: (confirmed: T, retryValue: T, error: unknown) => void;
  onStatusChange: (status: LatestStateSaveStatus) => void;
};

export class LatestStateSaveQueue<T> {
  private readonly options: LatestStateSaveQueueOptions<T>;
  private confirmed: T;
  private pending: T | null = null;
  private retryValue: T | null = null;
  private running = false;
  private disposed = false;
  private generation = 0;

  constructor(options: LatestStateSaveQueueOptions<T>) {
    this.options = options;
    this.confirmed = options.initialConfirmed;
  }

  enqueue(value: T) {
    if (this.disposed) return;

    this.pending = value;
    this.retryValue = null;
    this.options.onOptimistic(value);
    this.options.onStatusChange('saving');

    if (!this.running) {
      void this.drain();
    }
  }

  retry(): boolean {
    if (this.disposed || this.retryValue === null) return false;

    const value = this.retryValue;
    this.enqueue(value);
    return true;
  }

  syncConfirmed(value: T): boolean {
    if (this.disposed || this.running || this.pending !== null) return false;

    this.confirmed = value;
    return true;
  }

  dispose() {
    this.disposed = true;
    this.pending = null;
    this.retryValue = null;
    this.generation += 1;
  }

  private async drain() {
    if (this.running || this.disposed) return;

    this.running = true;
    const runGeneration = this.generation;

    try {
      while (!this.disposed && this.pending !== null) {
        const value = this.pending;
        this.pending = null;

        try {
          const persisted = await this.options.persist(value);
          if (this.disposed || runGeneration !== this.generation) return;

          this.confirmed = persisted;
          if (this.pending === null) {
            this.options.onConfirmed(persisted);
            this.options.onStatusChange('saved');
          }
        } catch (error) {
          if (this.disposed || runGeneration !== this.generation) return;

          const retryValue = this.pending ?? value;
          this.pending = null;
          this.retryValue = retryValue;
          this.options.onRollback(this.confirmed, retryValue, error);
          this.options.onStatusChange('error');
          return;
        }
      }
    } finally {
      this.running = false;
    }
  }
}
