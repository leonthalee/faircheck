import { createServer } from '../web/server.js';
import { DEFAULT_STORE_PATH } from './importCli.js';

const DEFAULT_PORT = 3000;

export function runServe(args: string[]): void {
  const storePath = args[0] ?? DEFAULT_STORE_PATH;
  const port = args[1] ? Number(args[1]) : Number(process.env['PORT'] ?? DEFAULT_PORT);

  if (Number.isNaN(port)) {
    console.error(`Ungültiger Port: "${args[1]}"`);
    process.exitCode = 1;
    return;
  }

  const app = createServer(storePath);
  app.listen(port, () => {
    console.log(`Web-Oberfläche läuft auf http://localhost:${port}`);
    console.log(`Store: ${storePath}`);
  });
}
