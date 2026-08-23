import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDocument, fromDocument } from '../src/storage/mongo/mapping.js';
import { makeReceipt } from './storeConformance.js';

test('a receipt survives the round trip to a document and back unchanged', () => {
  const receipt = makeReceipt('r1', '2026-03-03T16:20:00.000Z', ['Brot', 'Milch']);
  receipt.label = 'Wocheneinkauf';
  receipt.items[0]!.tags = ['gemeinsam', 'Alice'];

  assert.deepEqual(fromDocument(toDocument(receipt)), receipt);
});

test('the receipt id becomes _id and no duplicate id field is stored', () => {
  const doc = toDocument(makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot']));

  assert.equal(doc._id, 'r1');
  assert.ok(!('id' in doc), 'storing both _id and id would be a redundant second copy of the identity');
});

test('toDocument does not mutate its argument', () => {
  // ReceiptStore forbids mutating the input, and runTagCli depends on it:
  // if toDocument stripped `id` in place, the next save in its loop would
  // serialise a receipt that no longer has one.
  const receipt = makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot']);
  const snapshot = structuredClone(receipt);

  toDocument(receipt);

  assert.deepEqual(receipt, snapshot);
});

test('the date stays a Date object rather than being serialised', () => {
  const receipt = makeReceipt('r1', '2026-03-03T16:20:00.000Z', ['Brot']);
  const doc = toDocument(receipt);

  assert.ok(doc.date instanceof Date);
  assert.equal(doc.date.getTime(), receipt.date.getTime());
});

test('null fields are kept, not dropped', () => {
  const doc = toDocument(makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot']));

  // Storing null explicitly is what lets a document round-trip to a receipt
  // that deep-equals the original, which the conformance suite asserts.
  assert.equal(doc.address, null);
  assert.ok('address' in doc);
});
