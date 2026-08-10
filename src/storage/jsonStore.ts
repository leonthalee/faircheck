import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Receipt } from '../types.js';

type SerializedReceipt = Omit<Receipt, 'date'> & { date: string };

export function loadReceipts(filePath: string): Receipt[] {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as SerializedReceipt[];
  return parsed.map((r) => ({ ...r, date: new Date(r.date) }));
}

export function saveReceipts(filePath: string, receipts: Receipt[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(receipts, null, 2), 'utf-8');
}
