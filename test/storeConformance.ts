import { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Receipt } from '../src/types.js';
import type { ReceiptStore } from '../src/storage/receiptStore.js';

export function makeReceipt(id: string, date: string, itemNames: string[]): Receipt {
  return {
    id,
    label: null,
    date: new Date(date),
    store: 'Testladen',
    address: null,
    description: null,
    amount: -1 * itemNames.length,
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

/**
 * The behaviour every `ReceiptStore` must show, run against each
 * implementation so "they are interchangeable" is demonstrated rather than
 * asserted. Any divergence — ordering, dropped nulls, a shifted date — fails
 * here instead of surfacing as a bug after a backend switch.
 */
export function runStoreConformanceTests(
  name: string,
  createStore: () => Promise<ReceiptStore>,
  cleanup: () => Promise<void> = async () => {},
): void {
  describe(`ReceiptStore conformance: ${name}`, () => {
    let store: ReceiptStore;

    beforeEach(async () => {
      store = await createStore();
      await store.saveReceipts([]);
    });

    afterEach(async () => {
      // Not optional for a connection-backed store: an unclosed client keeps
      // the event loop alive and the test run never finishes. `close` is
      // specified as safe to call twice, so the test that closes early is fine.
      await store.close();
    });

    after(async () => {
      await cleanup();
    });

    it('reads back an empty store as an empty array', async () => {
      assert.deepEqual(await store.loadReceipts(), []);
    });

    it('round-trips a receipt unchanged, including nulls and item tags', async () => {
      const original = makeReceipt('r1', '2026-03-03T16:20:00.000Z', ['Brot', 'Milch']);
      original.label = 'Wocheneinkauf';
      original.items[0]!.tags = ['gemeinsam', 'Alice'];

      await store.saveReceipts([original]);
      const [loaded] = await store.loadReceipts();

      assert.ok(loaded);
      assert.equal(loaded.id, 'r1');
      assert.equal(loaded.label, 'Wocheneinkauf');
      assert.equal(loaded.address, null, 'null fields must survive, not become undefined');
      assert.equal(loaded.date.getTime(), original.date.getTime(), 'the instant must be preserved exactly');
      assert.deepEqual(
        loaded.items.map((i) => i.name),
        ['Brot', 'Milch'],
        'item order within a receipt must be preserved',
      );
      assert.deepEqual(loaded.items[0]!.tags, ['gemeinsam', 'Alice']);
      assert.deepEqual(loaded.items[1]!.tags, []);
    });

    it('returns receipts newest first, with the id breaking ties', async () => {
      const older = makeReceipt('b', '2026-01-05T12:00:00.000Z', ['x']);
      const newer = makeReceipt('c', '2026-06-05T12:00:00.000Z', ['x']);
      const sameDayAsNewer = makeReceipt('a', '2026-06-05T12:00:00.000Z', ['x']);

      await store.saveReceipts([older, newer, sameDayAsNewer]);

      assert.deepEqual(
        (await store.loadReceipts()).map((r) => r.id),
        ['a', 'c', 'b'],
      );
    });

    it('saving twice leaves the same contents', async () => {
      const receipts = [makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot'])];

      await store.saveReceipts(receipts);
      const first = await store.loadReceipts();
      await store.saveReceipts(receipts);
      const second = await store.loadReceipts();

      assert.deepEqual(first, second);
    });

    it('adds receipts that are new and removes ones no longer present', async () => {
      await store.saveReceipts([
        makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot']),
        makeReceipt('r2', '2026-04-03T12:00:00.000Z', ['Milch']),
      ]);

      await store.saveReceipts([
        makeReceipt('r2', '2026-04-03T12:00:00.000Z', ['Milch']),
        makeReceipt('r3', '2026-05-03T12:00:00.000Z', ['Kaese']),
      ]);

      assert.deepEqual(
        (await store.loadReceipts()).map((r) => r.id),
        ['r3', 'r2'],
      );
    });

    it('saving an empty array empties the store', async () => {
      await store.saveReceipts([makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot'])]);
      await store.saveReceipts([]);
      assert.deepEqual(await store.loadReceipts(), []);
    });

    it('does not mutate the array it was given, nor the receipts inside it', async () => {
      // runTagCli keeps live references into the loaded array across repeated
      // saves, so a store that reshaped its input would corrupt the next edit.
      const receipts = [makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot', 'Milch'])];
      const snapshot = structuredClone(receipts);

      await store.saveReceipts(receipts);

      assert.deepEqual(receipts, snapshot);
    });

    it('keeps a store usable after close', async () => {
      await store.close();
      await store.close(); // must be safe to call more than once
    });

    it('describes its location without exposing credentials', async () => {
      const description = store.describe();
      assert.ok(description.length > 0);
      assert.doesNotMatch(description, /:\/\/[^/@]*:[^/@]*@/, 'must not contain user:password@');
    });
  });
}
