import type { IndexDescription } from 'mongodb';

/**
 * `_id` needs no entry — it is indexed by definition, which is half the reason
 * the receipt id is used as `_id` in the first place.
 */
export const RECEIPT_INDEXES: IndexDescription[] = [
  // The monthly spending view is a date range, and every list view sorts
  // newest first. Serves both, and keeps an unindexed in-memory sort (capped
  // at 32 MB, and an error past it) off the table.
  //
  // The direction is cosmetic for a single-field index — MongoDB walks it
  // either way. It only matters in compound indexes.
  { key: { date: -1 }, name: 'date_desc' },

  // Multikey: one index entry per array element, so filtering items by tag
  // for a cost split is a seek instead of a collection scan.
  { key: { 'items.tags': 1 }, name: 'item_tags' },

  // Multikey. Pays off once tag edits become targeted single-document
  // updates: `updateOne({ 'items.id': … })` would otherwise scan every
  // receipt on every edit from the web UI.
  //
  // Not unique on purpose. Item ids are `${receiptId}:${index}` and therefore
  // already unique by construction, so a unique index would enforce nothing
  // new while adding a way for re-imports and migrations to fail.
  { key: { 'items.id': 1 }, name: 'item_id' },
];

// Deliberately absent: an index on `store`. Nothing queries by it — the
// interactive search filters an already-loaded list in memory. Every index
// costs write throughput, memory in the working set, and disk, so the rule is
// no index without a query.
