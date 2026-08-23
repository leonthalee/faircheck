import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { resolveStoreConfig } from '../config.js';
import { createReceiptStore } from '../storage/createReceiptStore.js';

const store = await createReceiptStore(resolveStoreConfig(process.argv[2]));
const server = createServer(store);
const transport = new StdioServerTransport();
await server.connect(transport);

// This process outlives the command that started it, so the store is released
// on shutdown rather than after a single operation.
let shuttingDown = false;
const shutdown = (): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  void store.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
