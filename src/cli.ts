import { resolveStoreConfig } from './config.js';
import { createReceiptStore } from './storage/createReceiptStore.js';
import { runImport } from './cli/importCli.js';
import { runTagCli } from './cli/tagCli.js';
import { runTagReceiptCli } from './cli/tagReceiptCli.js';
import { runUntagReceiptCli } from './cli/untagReceiptCli.js';
import { runLabelReceiptCli } from './cli/labelReceiptCli.js';
import { runDeleteReceiptCli } from './cli/deleteReceiptCli.js';
import { runSplitCli } from './cli/splitCli.js';
import { runServe } from './cli/serveCli.js';

const COMMANDS = new Set([
  'import',
  'tag',
  'tag-receipt',
  'untag-receipt',
  'label-receipt',
  'delete-receipt',
  'split',
  'serve',
]);

function printUsage(): void {
  console.log('Verwendung:');
  console.log('  cli import <csv-datei> [store-datei]   CSV importieren/mergen (Tags bleiben erhalten)');
  console.log('  cli tag [store-datei]                  Interaktiv Tags für ein einzelnes Item vergeben');
  console.log('  cli tag-receipt [store-datei]          Tag(s) zu allen Items eines Belegs hinzufügen');
  console.log('  cli untag-receipt [store-datei]        Alle Tags von allen Items eines Belegs entfernen');
  console.log('  cli label-receipt [store-datei]        Eigenen Namen für einen Beleg setzen');
  console.log('  cli delete-receipt [store-datei]       Einen Beleg komplett löschen');
  console.log('  cli split [store-datei]                Kosten pro Person aufteilen (gemeinsam + individuell)');
  console.log('  cli serve [store-datei] [port]         Lokale Weboberfläche starten (Default-Port 3000)');
  console.log('');
  console.log('Ohne [store-datei] entscheidet die Konfiguration: MONGODB_URI gesetzt -> MongoDB,');
  console.log('sonst die JSON-Datei (Default: data/receipts.json). Siehe .env.example.');
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  // Resolved before the store is built: printing usage must not open a
  // database connection.
  if (command === undefined || !COMMANDS.has(command)) {
    printUsage();
    process.exitCode = command === undefined ? 0 : 1;
    return;
  }

  // `import` takes the CSV path first, so its optional store path is the
  // second argument; every other command takes the store path first.
  const pathArg = command === 'import' ? rest[1] : rest[0];
  const store = await createReceiptStore(resolveStoreConfig(pathArg));

  // `serve` hands the store to a server that outlives this function and
  // returns immediately, so it takes over the lifetime — closing the store in
  // the `finally` below would kill the connection the moment the server starts.
  if (command === 'serve') {
    runServe(rest, store);
    return;
  }

  try {
    switch (command) {
      case 'import':
        await runImport(rest, store);
        break;
      case 'tag':
        await runTagCli(store);
        break;
      case 'tag-receipt':
        await runTagReceiptCli(store);
        break;
      case 'untag-receipt':
        await runUntagReceiptCli(store);
        break;
      case 'label-receipt':
        await runLabelReceiptCli(store);
        break;
      case 'delete-receipt':
        await runDeleteReceiptCli(store);
        break;
      case 'split':
        await runSplitCli(store);
        break;
    }
  } finally {
    // An open database connection keeps the event loop alive, so without this
    // the CLI prints its result and then hangs forever.
    await store.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  // Not process.exit(), so pending cleanup still runs.
  process.exitCode = 1;
});
