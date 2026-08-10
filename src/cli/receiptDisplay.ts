import type { Receipt } from '../types.js';

export const MAX_SEARCH_RESULTS = 30;

export function formatDateTime(date: Date): string {
  const day = date.toLocaleDateString('de-DE');
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

export function describeReceipt(receipt: Receipt): string {
  const amount = `${receipt.amount.toFixed(2)} ${receipt.currency}`;
  const name = receipt.label ? `${receipt.label} (${receipt.store})` : receipt.store;
  return `${formatDateTime(receipt.date)} ${name} — ${receipt.items.length} Artikel (${amount})`;
}

export function receiptMatches(receipt: Receipt, needle: string): boolean {
  return receipt.store.toLowerCase().includes(needle) || (receipt.label ?? '').toLowerCase().includes(needle);
}

export function isExitPromptError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}
