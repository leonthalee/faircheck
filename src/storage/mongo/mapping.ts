import type { Receipt } from '../../types.js';

/**
 * A receipt as stored: the domain `id` becomes `_id`, everything else is
 * unchanged. Items stay embedded — they are never read or written without
 * their receipt, so keeping them in one document makes every write a
 * single-document operation, which MongoDB guarantees to be atomic.
 */
export type ReceiptDoc = Omit<Receipt, 'id'> & { _id: string };

/**
 * Uses the receipt id from the source export as `_id`: it is already the
 * identity `mergeReceipts` matches on, and reusing it gets the uniqueness
 * constraint and the primary index for free, with no second index on a
 * duplicate `id` field.
 *
 * Builds a new object rather than reshaping the argument — `ReceiptStore`
 * forbids mutating the input, and `runTagCli` would break if we did.
 */
export function toDocument(receipt: Receipt): ReceiptDoc {
  const { id, ...rest } = receipt;
  return { _id: id, ...rest };
}

export function fromDocument(doc: ReceiptDoc): Receipt {
  const { _id, ...rest } = doc;
  // `date` needs no conversion: BSON has a native date type, so the driver
  // hands back a real Date. The JSON store has to revive it from a string.
  return { id: _id, ...rest };
}
