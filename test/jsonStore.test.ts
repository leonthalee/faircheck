import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonReceiptStore } from '../src/storage/jsonStore.js';
import { runStoreConformanceTests, makeReceipt } from './storeConformance.js';

const tmpRoot = await mkdtemp(path.join(tmpdir(), 'faircheck-json-'));
let counter = 0;

runStoreConformanceTests(
  'JsonReceiptStore',
  async () => new JsonReceiptStore(path.join(tmpRoot, `store-${counter++}.json`)),
  async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  },
);

test('a missing file reads as an empty store rather than throwing', async () => {
  const store = new JsonReceiptStore(path.join(tmpRoot, 'does', 'not', 'exist.json'));
  assert.deepEqual(await store.loadReceipts(), []);
});

test('saving creates missing parent directories', async () => {
  const filePath = path.join(tmpRoot, 'deeply', 'nested', 'store.json');
  const store = new JsonReceiptStore(filePath);

  await store.saveReceipts([makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot'])]);

  assert.equal((await store.loadReceipts()).length, 1);
});

test('a failed write leaves no temp file behind next to the store', async () => {
  const dir = path.join(tmpRoot, 'tmpcheck');
  const store = new JsonReceiptStore(path.join(dir, 'store.json'));

  await store.saveReceipts([makeReceipt('r1', '2026-03-03T12:00:00.000Z', ['Brot'])]);

  const entries = await readdir(dir);
  assert.deepEqual(entries, ['store.json'], 'the write-then-rename temp file must not survive');
});

test('a corrupt store file surfaces as an error instead of silently reading empty', async () => {
  const filePath = path.join(tmpRoot, 'corrupt.json');
  await writeFile(filePath, '{ not json', 'utf-8');
  const store = new JsonReceiptStore(filePath);

  await assert.rejects(() => store.loadReceipts());
});
