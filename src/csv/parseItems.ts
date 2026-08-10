import type { ReceiptItem } from '../types.js';

// Each item is encoded as 9 pipe-separated fields, followed by a trailing "|"
// (i.e. the encoding is effectively `fields.join('|') + '|'` per item, with
// items concatenated back to back). Splitting the whole string on "|" therefore
// yields 9 field tokens per item plus one empty separator token, except
// possibly for the very last item if it has no trailing pipe.
const FIELDS_PER_ITEM = 9;

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

export function parseItems(raw: string, receiptId: string): ReceiptItem[] {
  const trimmed = raw.trim();
  if (trimmed === '') return [];

  const tokens = trimmed.split('|');
  const items: ReceiptItem[] = [];
  let index = 0;

  for (let i = 0; i < tokens.length; ) {
    const chunk = tokens.slice(i, i + FIELDS_PER_ITEM);
    if (chunk.length < FIELDS_PER_ITEM) break;

    const [name, category, price, taxRate, priceBeforeTax, quantity, unit, unitPrice, unitPriceBeforeTax] = chunk;

    items.push({
      id: `${receiptId}:${index}`,
      name: (name ?? '').trim(),
      category: toNullableString(category),
      price: toNullableNumber(price),
      taxRate: toNullableNumber(taxRate),
      priceBeforeTax: toNullableNumber(priceBeforeTax),
      quantity: toNullableNumber(quantity),
      unit: toNullableString(unit),
      unitPrice: toNullableNumber(unitPrice),
      unitPriceBeforeTax: toNullableNumber(unitPriceBeforeTax),
      tags: [],
    });

    index += 1;
    i += FIELDS_PER_ITEM;

    // consume the trailing separator token between items, if present
    if (tokens[i] === '') {
      i += 1;
    }
  }

  return items;
}
