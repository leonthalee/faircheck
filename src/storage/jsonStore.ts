import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Receipt } from '../types.js';
import type { ReceiptStore } from './receiptStore.js';

type SerializedReceipt = Omit<Receipt, 'date'> & { date: string };

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Newest first, receipt id as tie-breaker — see `ReceiptStore.loadReceipts`. */
function byDateDesc(a: Receipt, b: Receipt): number {
  return b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id);
}

export async function loadReceipts(filePath: string): Promise<Receipt[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
  const parsed = JSON.parse(raw) as SerializedReceipt[];
  return parsed.map((r) => ({ ...r, date: new Date(r.date) })).sort(byDateDesc);
}

export async function saveReceipts(filePath: string, receipts: Receipt[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  // Write to a sibling and rename, rather than writing in place: writeFile
  // truncates first, so a crash mid-write would leave a half-written store
  // with no way back. rename is atomic within a filesystem.
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmpPath, JSON.stringify(receipts, null, 2), 'utf-8');
  await rename(tmpPath, filePath);
}

/** The default backend: one JSON file, no server required. */
export class JsonReceiptStore implements ReceiptStore {
  constructor(private readonly filePath: string) {}

  loadReceipts(): Promise<Receipt[]> {
    return loadReceipts(this.filePath);
  }

  saveReceipts(receipts: Receipt[]): Promise<void> {
    return saveReceipts(this.filePath, receipts);
  }

  /** Nothing to release — a file store holds no connection. */
  async close(): Promise<void> {}

  describe(): string {
    return this.filePath;
  }
}
