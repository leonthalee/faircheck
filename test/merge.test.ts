import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Receipt } from '../src/types.js';
import { mergeReceipts, setItemTags, setReceiptLabel, clearReceiptTags, deleteReceipt } from '../src/tags.js';

function makeReceipt(id: string, itemNames: string[]): Receipt {
  return {
    id,
    label: null,
    date: new Date(),
    store: 'Testladen',
    address: null,
    description: null,
    amount: 0,
    amountBeforeTax: null,
    paymentMethod: null,
    category: null,
    currency: 'EUR',
    transactionNumber: null,
    receiptNumber: null,
    notes: null,
    items: itemNames.map((name, index) => ({
      id: `${id}:${index}`,
      name,
      category: null,
      price: -1,
      taxRate: null,
      priceBeforeTax: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      unitPriceBeforeTax: null,
      tags: [],
    })),
  };
}

test('importing a second, different receipt keeps the first one in the store', () => {
  const existing = [makeReceipt('receipt-1', ['Brot'])];
  const fresh = [makeReceipt('receipt-2', ['Milch'])];

  const merged = mergeReceipts(fresh, existing);

  assert.equal(merged.length, 2);
  assert.ok(merged.some((r) => r.id === 'receipt-1'));
  assert.ok(merged.some((r) => r.id === 'receipt-2'));
});

test('re-importing the same receipt does not duplicate it and carries tags over', () => {
  const existing = [makeReceipt('receipt-1', ['Brot'])];
  setItemTags(existing, 'receipt-1:0', ['gemeinsam']);

  const fresh = [makeReceipt('receipt-1', ['Brot'])];
  const merged = mergeReceipts(fresh, existing);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0]!.items[0]!.tags, ['gemeinsam']);
});

test('mixed import: keeps untouched receipts, updates the re-imported one, adds the new one', () => {
  const existing = [makeReceipt('receipt-1', ['Brot']), makeReceipt('receipt-2', ['Milch'])];
  setItemTags(existing, 'receipt-1:0', ['gemeinsam']);
  setItemTags(existing, 'receipt-2:0', ['Person A']);

  const fresh = [makeReceipt('receipt-2', ['Milch']), makeReceipt('receipt-3', ['Kaese'])];
  const merged = mergeReceipts(fresh, existing);

  assert.equal(merged.length, 3);
  const byId = Object.fromEntries(merged.map((r) => [r.id, r]));
  assert.deepEqual(byId['receipt-1']!.items[0]!.tags, ['gemeinsam']);
  assert.deepEqual(byId['receipt-2']!.items[0]!.tags, ['Person A']);
  assert.deepEqual(byId['receipt-3']!.items[0]!.tags, []);
});

test('clearReceiptTags removes all tags from every item of that receipt only', () => {
  const receipts = [makeReceipt('receipt-1', ['Brot', 'Milch']), makeReceipt('receipt-2', ['Kaese'])];
  setItemTags(receipts, 'receipt-1:0', ['gemeinsam']);
  setItemTags(receipts, 'receipt-1:1', ['Person A']);
  setItemTags(receipts, 'receipt-2:0', ['gemeinsam']);

  const ok = clearReceiptTags(receipts, 'receipt-1');

  assert.equal(ok, true);
  assert.deepEqual(receipts[0]!.items[0]!.tags, []);
  assert.deepEqual(receipts[0]!.items[1]!.tags, []);
  assert.deepEqual(receipts[1]!.items[0]!.tags, ['gemeinsam']);
});

test('clearReceiptTags returns false for an unknown receipt id', () => {
  const receipts = [makeReceipt('receipt-1', ['Brot'])];
  const ok = clearReceiptTags(receipts, 'does-not-exist');
  assert.equal(ok, false);
});

test('setReceiptLabel sets and clears a receipt label', () => {
  const receipts = [makeReceipt('receipt-1', ['Brot'])];

  assert.equal(setReceiptLabel(receipts, 'receipt-1', 'Wocheneinkauf'), true);
  assert.equal(receipts[0]!.label, 'Wocheneinkauf');

  assert.equal(setReceiptLabel(receipts, 'receipt-1', null), true);
  assert.equal(receipts[0]!.label, null);

  assert.equal(setReceiptLabel(receipts, 'does-not-exist', 'x'), false);
});

test('re-importing a labeled receipt keeps the label', () => {
  const existing = [makeReceipt('receipt-1', ['Brot'])];
  setReceiptLabel(existing, 'receipt-1', 'Wocheneinkauf');

  const fresh = [makeReceipt('receipt-1', ['Brot'])];
  const merged = mergeReceipts(fresh, existing);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.label, 'Wocheneinkauf');
});

test('deleteReceipt removes only the targeted receipt', () => {
  const receipts = [makeReceipt('receipt-1', ['Brot']), makeReceipt('receipt-2', ['Milch'])];

  const ok = deleteReceipt(receipts, 'receipt-1');

  assert.equal(ok, true);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]!.id, 'receipt-2');
});

test('deleteReceipt returns false for an unknown receipt id and leaves the array untouched', () => {
  const receipts = [makeReceipt('receipt-1', ['Brot'])];

  const ok = deleteReceipt(receipts, 'does-not-exist');

  assert.equal(ok, false);
  assert.equal(receipts.length, 1);
});
