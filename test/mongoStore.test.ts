import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { MongoReceiptStore, redactUri } from '../src/storage/mongo/mongoStore.js';
import { runStoreConformanceTests } from './storeConformance.js';

/**
 * Requires a running MongoDB, so it skips itself when MONGODB_TEST_URI is
 * unset — `npm test` stays green on a fresh clone with no database.
 *
 * To run these: `docker compose up -d`, then put MONGODB_TEST_URI in .env
 * (see .env.example) and run `npm test` as usual.
 *
 * Deliberately not mongodb-memory-server: docker-compose.yml is in the repo
 * anyway, and testing against the same server version that is actually
 * deployed beats testing against a downloaded binary that drifts from it.
 */
if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env['MONGODB_TEST_URI'];

// A fresh database per run, dropped afterwards, so tests never share state
// and never touch the application's own database.
const dbName = `faircheck_test_${randomUUID().replace(/-/g, '')}`;

if (uri === undefined || uri === '') {
  describe('MongoReceiptStore', { skip: 'MONGODB_TEST_URI nicht gesetzt' }, () => {
    it('skipped', () => {});
  });
} else {
  // Dropped in a top-level hook rather than in the conformance suite's own
  // cleanup: that one fires when its describe block ends, and the suite below
  // would then recreate the database and leave it behind.
  after(async () => {
    const client = new MongoClient(uri);
    await client.connect();
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  runStoreConformanceTests('MongoReceiptStore', () => MongoReceiptStore.connect(uri, dbName));

  describe('MongoReceiptStore specifics', () => {
    it('creates the indexes the query patterns rely on', async () => {
      const store = await MongoReceiptStore.connect(uri, dbName);
      const client = new MongoClient(uri);
      await client.connect();
      try {
        const indexes = await client.db(dbName).collection('receipts').indexes();
        const names = indexes.map((i) => i.name).sort();
        assert.deepEqual(names, ['_id_', 'date_desc', 'item_id', 'item_tags']);
      } finally {
        await client.close();
        await store.close();
      }
    });

    it('connecting twice does not fail on the already-created indexes', async () => {
      const first = await MongoReceiptStore.connect(uri, dbName);
      const second = await MongoReceiptStore.connect(uri, dbName);
      await first.close();
      await second.close();
    });

    it('stores the date as a real BSON date, not a string', async () => {
      const store = await MongoReceiptStore.connect(uri, dbName);
      const client = new MongoClient(uri);
      await client.connect();
      try {
        const date = new Date('2026-03-03T16:20:00.000Z');
        await store.saveReceipts([
          {
            id: 'bson-date', label: null, date, store: 'Testladen', address: null, description: null,
            amount: -1, amountBeforeTax: null, paymentMethod: null, category: null, currency: 'EUR',
            transactionNumber: null, receiptNumber: null, notes: null, items: [],
          },
        ]);

        const raw = await client.db(dbName).collection('receipts').findOne({ _id: 'bson-date' as never });
        assert.ok(raw?.['date'] instanceof Date, 'date must be a BSON date so ranges and $dateTrunc work');
        assert.equal((raw['date'] as Date).getTime(), date.getTime());
      } finally {
        await client.close();
        await store.close();
      }
    });

    it('reports a failed connection as a clear error instead of hanging', async () => {
      await assert.rejects(
        () => MongoReceiptStore.connect('mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500', dbName),
        /Verbindung zu MongoDB fehlgeschlagen/,
      );
    });
  });
}

describe('redactUri', () => {
  it('removes the password from a connection string', () => {
    const redacted = redactUri('mongodb://faircheck:supersecret@localhost:27017/?authSource=admin');
    assert.doesNotMatch(redacted, /supersecret/);
    assert.match(redacted, /\*\*\*/);
  });

  it('removes the password from an Atlas SRV string', () => {
    const redacted = redactUri('mongodb+srv://leon:hunter2@cluster0.abcde.mongodb.net/faircheck');
    assert.doesNotMatch(redacted, /hunter2/);
    assert.match(redacted, /cluster0\.abcde\.mongodb\.net/);
  });

  it('leaves a credential-free string readable', () => {
    assert.match(redactUri('mongodb://localhost:27017'), /localhost:27017/);
  });

  it('falls back to a constant rather than printing something it cannot parse', () => {
    assert.equal(redactUri('nicht mal eine uri'), '(MongoDB)');
  });
});
