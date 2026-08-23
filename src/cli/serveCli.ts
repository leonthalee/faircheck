import { createServer } from '../web/server.js';
import type { ReceiptStore } from '../storage/receiptStore.js';

const DEFAULT_PORT = 3000;

export function runServe(args: string[], store: ReceiptStore): void {
  // args[0] is the optional store path, already resolved into `store` by the
  // caller; args[1] is the optional port.
  const port = args[1] ? Number(args[1]) : Number(process.env['PORT'] ?? DEFAULT_PORT);

  if (Number.isNaN(port)) {
    console.error(`Ungültiger Port: "${args[1]}"`);
    process.exitCode = 1;
    return;
  }

  const app = createServer(store);
  const httpServer = app.listen(port, () => {
    console.log(`Web-Oberfläche läuft auf http://localhost:${port}`);
    console.log(`Store: ${store.describe()}`);
  });

  // The server owns the store for as long as it runs, so releasing it is tied
  // to shutdown rather than to the end of the command.
  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    httpServer.close(() => {
      void store.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
