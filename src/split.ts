import type { Receipt } from './types.js';

export interface UnassignedItem {
  receiptId: string;
  itemId: string;
  name: string;
  price: number | null;
}

export interface SplitResult {
  participants: string[];
  sharedTag: string;
  /** Signed sum of shared-tagged items (negative = cost, matching item.price sign). */
  sharedTotal: number;
  /** sharedTotal divided evenly across participants. */
  perPersonShared: number;
  /** Signed sum of each participant's individually-tagged items. */
  individualTotals: Record<string, number>;
  /** individualTotals[person] + perPersonShared. */
  finalTotals: Record<string, number>;
  /** Items that matched neither the shared tag nor any participant tag. */
  unassigned: UnassignedItem[];
}

/**
 * An item tagged with more than one participant (e.g. a shared restaurant
 * dish split between two named people) is divided evenly between just those
 * participants rather than counted under `sharedTag`.
 */
export function computeSplit(receipts: Receipt[], sharedTag: string, participants: string[]): SplitResult {
  const individualTotals: Record<string, number> = Object.fromEntries(participants.map((p) => [p, 0]));
  let sharedTotal = 0;
  const unassigned: UnassignedItem[] = [];

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const price = item.price ?? 0;
      const matchedPersons = participants.filter((p) => item.tags.includes(p));

      if (matchedPersons.length > 0) {
        const share = price / matchedPersons.length;
        for (const person of matchedPersons) {
          individualTotals[person] = (individualTotals[person] ?? 0) + share;
        }
      } else if (item.tags.includes(sharedTag)) {
        sharedTotal += price;
      } else {
        unassigned.push({ receiptId: receipt.id, itemId: item.id, name: item.name, price: item.price });
      }
    }
  }

  const perPersonShared = participants.length > 0 ? sharedTotal / participants.length : 0;
  const finalTotals: Record<string, number> = {};
  for (const person of participants) {
    finalTotals[person] = (individualTotals[person] ?? 0) + perPersonShared;
  }

  return { participants, sharedTag, sharedTotal, perPersonShared, individualTotals, finalTotals, unassigned };
}
