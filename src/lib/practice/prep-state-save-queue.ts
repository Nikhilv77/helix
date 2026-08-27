export interface PrepStatePatch {
  draftAnswer?: string;
  note?: string;
  revealedHintCount?: number;
}

export type PrepStateSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export const PREP_STATE_RETRY_COUNT_MAX = 20;

export interface PrepStateDeliveryContext {
  retryCount: number;
}

type PrepStateSender = (patch: PrepStatePatch, context: PrepStateDeliveryContext) => Promise<void>;
type PrepStateStatusListener = (status: PrepStateSaveStatus) => void;

/**
 * Coalesces rapid editor changes and sends at most one Practice-state request
 * at a time. Serial delivery is important: an older draft must never arrive
 * after a newer draft and overwrite it.
 */
export class PrepStateSaveQueue {
  private pending: PrepStatePatch = {};
  private active: Promise<void> | null = null;
  private retryCount = 0;

  constructor(
    private readonly send: PrepStateSender,
    private readonly onStatus: PrepStateStatusListener = () => undefined
  ) {}

  enqueue(patch: PrepStatePatch): void {
    this.pending = { ...this.pending, ...patch };
    this.onStatus("dirty");
  }

  hasPendingChanges(): boolean {
    return hasFields(this.pending);
  }

  flush(): Promise<void> {
    if (this.active) return this.active;
    if (!this.hasPendingChanges()) return Promise.resolve();

    this.active = this.drain().finally(() => {
      this.active = null;
    });
    return this.active;
  }

  private async drain(): Promise<void> {
    this.onStatus("saving");
    try {
      while (this.hasPendingChanges()) {
        const patch = this.pending;
        this.pending = {};
        try {
          await this.send(patch, { retryCount: this.retryCount });
          this.retryCount = 0;
        } catch (error) {
          // Put failed fields back, but retain any newer value queued while the
          // request was in flight.
          this.pending = { ...patch, ...this.pending };
          this.retryCount = Math.min(this.retryCount + 1, PREP_STATE_RETRY_COUNT_MAX);
          throw error;
        }
      }
      this.onStatus("saved");
    } catch (error) {
      this.onStatus("error");
      throw error;
    }
  }
}

function hasFields(patch: PrepStatePatch): boolean {
  return Object.keys(patch).length > 0;
}
