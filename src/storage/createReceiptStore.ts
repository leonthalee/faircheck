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

  throw new Error('Der MongoDB-Store ist noch nicht implementiert.');
}
