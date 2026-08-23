import type { Receipt } from '../types.js';

/**
 * Where receipts are persisted. Implemented by the local JSON file store and
 * by MongoDB, so nothing outside `src/storage/` learns which one it is talking
 * to — the backend is chosen once at startup by `createReceiptStore`.
 */
export interface ReceiptStore {
  /**
   * Every receipt, newest first, with the receipt id as a tie-breaker so the
   * order is fully determined. Empty array when nothing is stored.
   *
   * The ordering is part of the contract rather than a property of the
   * backend: a file happens to preserve insertion order, a database promises
   * nothing without an explicit sort, and an order left unspecified is one the
   * two implementations would quietly disagree on.
   */
  loadReceipts(): Promise<Receipt[]>;

  /**
   * Replaces the entire contents with `receipts`: anything whose id is absent
   * from the array is removed, and an empty array empties the store.
   *
   * Must not mutate `receipts` or the objects within it. `runTagCli` holds
   * live references into the loaded array across repeated saves, so a store
   * that reshaped its input would corrupt the caller's next edit.
   */
  saveReceipts(receipts: Receipt[]): Promise<void>;

  /** Releases held resources. Safe to call more than once. */
  close(): Promise<void>;

  /**
   * Human-readable location, safe to print. Implementations backed by a
   * connection string must redact the credentials — this ends up in startup
   * logs and in README screenshots.
   */
  describe(): string;
}
