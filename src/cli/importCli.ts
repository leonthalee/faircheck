import { importCsvFile } from '../importCsv.js';
import type { ReceiptStore } from '../storage/receiptStore.js';

export async function runImport(args: string[], store: ReceiptStore): Promise<void> {
  // args[1] is the optional store path, already resolved into `store` by the
  // caller; only the CSV path is still read here.
  const [csvPath] = args;
  if (!csvPath) {
    console.error('Verwendung: import <csv-datei> [store-datei]');
    process.exitCode = 1;
    return;
  }

  const receipts = await importCsvFile(csvPath, store);
  const itemCount = receipts.reduce((sum, r) => sum + r.items.length, 0);
  console.log(`Importiert: ${receipts.length} Beleg(e), ${itemCount} Artikel -> ${store.describe()}`);
}
