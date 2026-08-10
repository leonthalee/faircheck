import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Receipt } from '../src/types.js';
import { computeSplit } from '../src/split.js';

function makeReceipt(id: string, items: Array<{ name: string; price: number; tags: string[] }>): Receipt {
  return {
    id,
    label: null,
    date: new Date(),
    store: 'Testladen',
    address: null,
    description: null,
    amount: items.reduce((sum, i) => sum + i.price, 0),
    amountBeforeTax: null,
    paymentMethod: null,
    category: null,
    currency: 'EUR',
    transactionNumber: null,
    receiptNumber: null,
    notes: null,
    items: items.map((i, index) => ({
      id: `${id}:${index}`,
      name: i.name,
      category: null,
      price: i.price,
      taxRate: null,
      priceBeforeTax: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      unitPriceBeforeTax: null,
      tags: i.tags,
    })),
  };
}

test('splits shared costs evenly and keeps individual costs separate', () => {
  const receipt = makeReceipt('r1', [
    { name: 'Brot', price: -2, tags: ['gemeinsam'] },
    { name: 'Milch', price: -1, tags: ['gemeinsam'] },
    { name: 'Bier A', price: -3, tags: ['Person A'] },
    { name: 'Bier B', price: -4, tags: ['Person B'] },
  ]);

  const result = computeSplit([receipt], 'gemeinsam', ['Person A', 'Person B']);

  assert.equal(result.sharedTotal, -3);
  assert.equal(result.perPersonShared, -1.5);
  assert.equal(result.individualTotals['Person A'], -3);
  assert.equal(result.individualTotals['Person B'], -4);
  assert.equal(result.finalTotals['Person A'], -4.5);
  assert.equal(result.finalTotals['Person B'], -5.5);
  assert.equal(result.unassigned.length, 0);
});

test('splits an item tagged with multiple persons evenly between just those persons', () => {
  const receipt = makeReceipt('r2', [{ name: 'Pizza', price: -10, tags: ['Person A', 'Person B'] }]);

  const result = computeSplit([receipt], 'gemeinsam', ['Person A', 'Person B']);

  assert.equal(result.individualTotals['Person A'], -5);
  assert.equal(result.individualTotals['Person B'], -5);
  assert.equal(result.sharedTotal, 0);
});

test('collects items without a shared or person tag as unassigned', () => {
  const receipt = makeReceipt('r3', [{ name: 'Zeitschrift', price: -2, tags: ['Sonstiges'] }]);

  const result = computeSplit([receipt], 'gemeinsam', ['Person A']);

  assert.equal(result.unassigned.length, 1);
  assert.equal(result.unassigned[0]!.name, 'Zeitschrift');
  assert.equal(result.sharedTotal, 0);
  assert.equal(result.individualTotals['Person A'], 0);
});
