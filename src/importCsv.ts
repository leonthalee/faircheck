import { readFileSync } from 'node:fs';
import type { Receipt } from './types.js';
import { parseReceiptsCsv } from './csv/parseReceipts.js';
import { loadReceipts, saveReceipts } from './storage/jsonStore.js';
import { mergeReceipts } from './tags.js';

/**
 * Parses a CSV file and merges the result into the JSON store at `storePath`,
 * adding to (not replacing) whatever receipts are already there, and
 * preserving any tags already assigned to items from a previous import.
 */
export function importCsvFile(csvPath: string, storePath: string): Receipt[] {
  const csvContent = readFileSync(csvPath, 'utf-8');
  const freshReceipts = parseReceiptsCsv(csvContent);
  const existingReceipts = loadReceipts(storePath);
  const merged = mergeReceipts(freshReceipts, existingReceipts);
  saveReceipts(storePath, merged);
  return merged;
}
