import type { StoreConfig } from '../config.js';
import type { ReceiptStore } from './receiptStore.js';
import { JsonReceiptStore } from './jsonStore.js';

/**
 * The single place a backend is chosen. Everything downstream sees only
 * `ReceiptStore`, so adding an implementation touches this function and
 * nothing else.
 */
export async function createReceiptStore(config: StoreConfig): Promise<ReceiptStore> {
  if (config.kind === 'json') {
    return new JsonReceiptStore(config.filePath);
  }

  // Imported lazily so a JSON-only user never loads the driver.
  const { MongoReceiptStore } = await import('./mongo/mongoStore.js');
  return MongoReceiptStore.connect(config.uri, config.dbName);
}
