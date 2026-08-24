import { MongoClient } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import type { Receipt } from '../../types.js';
import type { ReceiptStore } from '../receiptStore.js';
import { fromDocument, toDocument } from './mapping.js';
import type { ReceiptDoc } from './mapping.js';
import { RECEIPT_INDEXES } from './indexes.js';

const COLLECTION = 'receipts';
const DEFAULT_DB_NAME = 'faircheck';

/**
 * Strips credentials from a connection string so it can be logged. Falls back
 * to a constant rather than the raw URI: a string we cannot parse is exactly
 * the one we must not print.
 */
export function redactUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '';
    }
    return parsed.toString();
  } catch {
    return '(MongoDB)';
  }
}

export class MongoReceiptStore implements ReceiptStore {
  private constructor(
    private readonly client: MongoClient,
    private readonly collection: Collection<ReceiptDoc>,
    private readonly location: string,
  ) {}

  /**
   * Connects eagerly and creates the indexes before returning. Failing here,
   * with a clear message, beats failing halfway through an interactive
   * tagging session.
   *
   * Index creation is idempotent — an existing index is a no-op. At
   * production scale this would belong in a deploy step rather than in
   * application startup; at this size, boot time is the right trade.
   */
  static async connect(uri: string, dbName: string | undefined): Promise<MongoReceiptStore> {
    const client = new MongoClient(uri);
    try {
      await client.connect();
      // `client.db()` with no argument uses the database named in the
      // connection string, which is what an Atlas URI usually carries.
      const db: Db = dbName !== undefined && dbName !== '' ? client.db(dbName) : client.db(DEFAULT_DB_NAME);
      const collection = db.collection<ReceiptDoc>(COLLECTION);
      await collection.createIndexes(RECEIPT_INDEXES);
      return new MongoReceiptStore(client, collection, `${redactUri(uri)} (db: ${db.databaseName})`);
    } catch (error) {
      await client.close().catch(() => {});
      throw new Error(`Verbindung zu MongoDB fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }

  async loadReceipts(): Promise<Receipt[]> {
    // Sorted in the database. Without an explicit sort MongoDB promises no
    // order at all, and `ReceiptStore` specifies one.
    const docs = await this.collection.find().sort({ date: -1, _id: 1 }).toArray();
    return docs.map(fromDocument);
  }

  async saveReceipts(receipts: Receipt[]): Promise<void> {
    const ids = receipts.map((receipt) => receipt.id);

    // One round trip. `ordered: true` is load-bearing: it guarantees the
    // upserts run before the deletion, so an interrupted save leaves stale
    // extra receipts — recoverable, and fixed by the next save — rather than
    // deleted ones. Delete-first would invert that into data loss.
    //
    // `replaceOne` rather than `$set`, so a field that went from a value to
    // absent does not linger; the document ends up exactly the projection of
    // the domain object.
    //
    // Note that saving [] therefore empties the collection ($nin: [] matches
    // everything). That matches the JSON store and is covered by a test.
    await this.collection.bulkWrite(
      [
        ...receipts.map((receipt) => ({
          replaceOne: {
            filter: { _id: receipt.id },
            replacement: toDocument(receipt),
            upsert: true,
          },
        })),
        { deleteMany: { filter: { _id: { $nin: ids } } } },
      ],
      { ordered: true },
    );
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  describe(): string {
    return this.location;
  }
}
