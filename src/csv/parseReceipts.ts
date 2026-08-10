import { parse } from 'csv-parse/sync';
import type { Receipt } from '../types.js';
import { parseItems } from './parseItems.js';

// Columns are addressed by position rather than by header name: the exporter
// pads header labels with whitespace and describes the item sub-format in the
// last header cell, so matching on exact header text would be fragile.
const COL = {
  id: 0,
  datum: 1,
  uhrzeit: 2,
  geschaeft: 3,
  adresse: 4,
  beschreibung: 5,
  betrag: 6,
  betragVorSteuern: 7,
  zahlungsmethode: 8,
  kategorie: 9,
  waehrung: 10,
  transaktionsnummer: 11,
  belegnummer: 12,
  notizen: 13,
  items: 14,
} as const;

function toNullableString(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function toNullableNumber(value: string | undefined): number | null {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

function parseGermanDateTime(dateStr: string, timeStr: string): Date {
  const [day, month, year] = dateStr.split('.').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0);
}

export interface ParseReceiptsOptions {
  /** Whether the first row is a header row that should be skipped. Default: true. */
  hasHeader?: boolean;
}

export function parseReceiptsCsv(csvContent: string, options: ParseReceiptsOptions = {}): Receipt[] {
  const { hasHeader = true } = options;

  const rows: string[][] = parse(csvContent, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => {
    const id = (row[COL.id] ?? '').trim();

    return {
      id,
      label: null,
      date: parseGermanDateTime(row[COL.datum] ?? '', row[COL.uhrzeit] ?? ''),
      store: (row[COL.geschaeft] ?? '').trim(),
      address: toNullableString(row[COL.adresse]),
      description: toNullableString(row[COL.beschreibung]),
      amount: toNullableNumber(row[COL.betrag]) ?? 0,
      amountBeforeTax: toNullableNumber(row[COL.betragVorSteuern]),
      paymentMethod: toNullableString(row[COL.zahlungsmethode]),
      category: toNullableString(row[COL.kategorie]),
      currency: (row[COL.waehrung] ?? '').trim(),
      transactionNumber: toNullableString(row[COL.transaktionsnummer]),
      receiptNumber: toNullableString(row[COL.belegnummer]),
      notes: toNullableString(row[COL.notizen]),
      items: parseItems(row[COL.items] ?? '', id),
    };
  });
}
