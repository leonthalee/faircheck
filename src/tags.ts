import type { Receipt } from './types.js';

/**
 * Merges a freshly parsed CSV import into the existing store: receipts already
 * on file that aren't part of this import are kept as-is (so importing a
 * second, different CSV adds to the store instead of replacing it), and
 * receipts that ARE part of this import get their item tags and label carried
 * over (matched by id) so re-importing the same CSV doesn't wipe out tags or
 * labels assigned earlier.
 */
export function mergeReceipts(freshReceipts: Receipt[], existingReceipts: Receipt[]): Receipt[] {
  const existingTagsByItemId = new Map<string, string[]>();
  const existingLabelByReceiptId = new Map<string, string | null>();
  for (const receipt of existingReceipts) {
    if (receipt.label !== null) existingLabelByReceiptId.set(receipt.id, receipt.label);
    for (const item of receipt.items) {
      if (item.tags.length > 0) existingTagsByItemId.set(item.id, item.tags);
    }
  }

  const freshIds = new Set(freshReceipts.map((receipt) => receipt.id));
  const updatedFresh = freshReceipts.map((receipt) => ({
    ...receipt,
    label: existingLabelByReceiptId.get(receipt.id) ?? receipt.label,
    items: receipt.items.map((item) => ({
      ...item,
      tags: existingTagsByItemId.get(item.id) ?? item.tags,
    })),
  }));

  const untouchedExisting = existingReceipts.filter((receipt) => !freshIds.has(receipt.id));

  return [...untouchedExisting, ...updatedFresh];
}

function findItem(receipts: Receipt[], itemId: string) {
  for (const receipt of receipts) {
    const item = receipt.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
}

export function setItemTags(receipts: Receipt[], itemId: string, tags: string[]): boolean {
  const item = findItem(receipts, itemId);
  if (!item) return false;
  item.tags = tags;
  return true;
}

export function addItemTag(receipts: Receipt[], itemId: string, tag: string): boolean {
  const item = findItem(receipts, itemId);
  if (!item) return false;
  if (!item.tags.includes(tag)) item.tags.push(tag);
  return true;
}

export function removeItemTag(receipts: Receipt[], itemId: string, tag: string): boolean {
  const item = findItem(receipts, itemId);
  if (!item) return false;
  item.tags = item.tags.filter((t) => t !== tag);
  return true;
}

/** Sets (or clears, with `null`) the user-assigned display label of a receipt. */
export function setReceiptLabel(receipts: Receipt[], receiptId: string, label: string | null): boolean {
  const receipt = receipts.find((r) => r.id === receiptId);
  if (!receipt) return false;
  receipt.label = label;
  return true;
}

/** Removes all tags from every item of the given receipt. */
export function clearReceiptTags(receipts: Receipt[], receiptId: string): boolean {
  const receipt = receipts.find((r) => r.id === receiptId);
  if (!receipt) return false;
  for (const item of receipt.items) {
    item.tags = [];
  }
  return true;
}

/** Removes the given receipt (and all its items/tags) from the array in place. */
export function deleteReceipt(receipts: Receipt[], receiptId: string): boolean {
  const index = receipts.findIndex((r) => r.id === receiptId);
  if (index === -1) return false;
  receipts.splice(index, 1);
  return true;
}

/** Counts how many items carry each tag across all receipts. */
export function collectTags(receipts: Receipt[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return counts;
}
