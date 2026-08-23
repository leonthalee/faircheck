import { readFile } from 'node:fs/promises';
import type { Receipt } from './types.js';
import { parseReceiptsCsv } from './csv/parseReceipts.js';
import type { ReceiptStore } from './storage/receiptStore.js';
import { mergeReceipts } from './tags.js';

/**
 * Parses a CSV file and merges the result into `store`, adding to (not
 * replacing) whatever receipts are already there, and preserving any tags
 * already assigned to items from a previous import.
 */
export async function importCsvFile(csvPath: string, store: ReceiptStore): Promise<Receipt[]> {
  const csvContent = await readFile(csvPath, 'utf-8');
  const freshReceipts = parseReceiptsCsv(csvContent);
  const existingReceipts = await store.loadReceipts();
  const merged = mergeReceipts(freshReceipts, existingReceipts);
  await store.saveReceipts(merged);
  return merged;
}
