import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseReceiptsCsv } from '../src/csv/parseReceipts.js';

const csvPath = path.join(import.meta.dirname, '..', 'fixtures', 'sample.csv');
const csv = readFileSync(csvPath, 'utf-8');

test('parses receipt header fields', () => {
  const [receipt] = parseReceiptsCsv(csv);
  assert.ok(receipt);
  assert.equal(receipt!.id, 'SAMPLEID000000000001');
  assert.equal(receipt!.store, 'MUSTERMARKT');
  assert.equal(receipt!.amount, -17.06);
  assert.equal(receipt!.currency, 'EUR');
  assert.equal(receipt!.category, 'Lebensmittel');
  assert.equal(receipt!.paymentMethod, 'Karte (Visa)');
  assert.equal(receipt!.address, 'Beispielweg 12, 79100 Freiburg im Breisgau, Germany');
  assert.equal(receipt!.description, null);
  assert.equal(receipt!.date.getFullYear(), 2026);
  assert.equal(receipt!.date.getMonth(), 2);
  assert.equal(receipt!.date.getDate(), 3);
  assert.equal(receipt!.date.getHours(), 17);
  assert.equal(receipt!.date.getMinutes(), 20);
});

test('parses all receipt items with correct field mapping', () => {
  const [receipt] = parseReceiptsCsv(csv);
  assert.equal(receipt!.items.length, 7);

  const bananen = receipt!.items[0]!;
  assert.equal(bananen.name, 'BIO BANANEN');
  assert.equal(bananen.price, -1.49);
  assert.equal(bananen.quantity, 0.62);
  assert.equal(bananen.unit, 'KILOGRAM');
  assert.equal(bananen.unitPrice, -2.4);
  assert.deepEqual(bananen.tags, []);

  const brot = receipt!.items[1]!;
  assert.equal(brot.name, 'VOLLKORNBROT');
  assert.equal(brot.price, -2.79);
  assert.equal(brot.quantity, null);
  assert.equal(brot.unit, null);

  const tomaten = receipt!.items.find((i) => i.name === 'TOMATEN')!;
  assert.equal(tomaten.price, -2.1);
  assert.equal(tomaten.quantity, 0.84);
  assert.equal(tomaten.unit, 'KILOGRAM');
  assert.equal(tomaten.unitPrice, -2.5);

  const joghurt = receipt!.items.find((i) => i.name === 'JOGHURT NATUR')!;
  assert.equal(joghurt.price, -1.95);
  assert.equal(joghurt.quantity, 3);
  assert.equal(joghurt.unitPrice, -0.65);

  const pfand = receipt!.items.find((i) => i.name === 'PFAND')!;
  assert.equal(pfand.price, 0.25);

  const last = receipt!.items[receipt!.items.length - 1]!;
  assert.equal(last.name, 'KAFFEEBOHNEN');
  assert.equal(last.price, -6.99);
});
