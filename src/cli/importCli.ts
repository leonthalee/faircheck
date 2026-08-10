import path from 'node:path';
import { importCsvFile } from '../importCsv.js';

export const DEFAULT_STORE_PATH = path.join('data', 'receipts.json');

export function runImport(args: string[]): void {
  const [csvPath, storePath = DEFAULT_STORE_PATH] = args;
  if (!csvPath) {
    console.error('Verwendung: import <csv-datei> [store-datei]');
    process.exitCode = 1;
    return;
  }

  const receipts = importCsvFile(csvPath, storePath);
  const itemCount = receipts.reduce((sum, r) => sum + r.items.length, 0);
  console.log(`Importiert: ${receipts.length} Beleg(e), ${itemCount} Artikel -> ${storePath}`);
}
