import { input, search } from '@inquirer/prompts';
import type { Receipt } from '../types.js';
import { loadReceipts, saveReceipts } from '../storage/jsonStore.js';
import { DEFAULT_STORE_PATH } from './importCli.js';
import { MAX_SEARCH_RESULTS, describeReceipt, receiptMatches, isExitPromptError } from './receiptDisplay.js';

export async function runTagReceiptCli(args: string[]): Promise<void> {
  const storePath = args[0] ?? DEFAULT_STORE_PATH;
  const receipts = loadReceipts(storePath);

  if (receipts.length === 0) {
    console.log(`Keine Belege in "${storePath}" gefunden. Erst importieren:`);
    console.log(`  npm run cli -- import <csv-datei> ${storePath}`);
    return;
  }

  try {
    const receipt = await search<Receipt>({
      message: 'Beleg suchen (Geschäft eingeben, leer = alle)',
      source: async (term) => {
        const needle = (term ?? '').trim().toLowerCase();
        const matches = needle === '' ? receipts : receipts.filter((r) => receiptMatches(r, needle));
        return matches.slice(0, MAX_SEARCH_RESULTS).map((r) => ({ name: describeReceipt(r), value: r }));
      },
    });

    const answer = await input({
      message: `Tag(s) für alle ${receipt.items.length} Artikel von "${receipt.store}" (kommagetrennt, wird zu bestehenden Tags hinzugefügt)`,
    });
    const tags = answer
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag !== '');

    if (tags.length === 0) {
      console.log('Kein Tag eingegeben, nichts geändert.');
      return;
    }

    for (const item of receipt.items) {
      for (const tag of tags) {
        if (!item.tags.includes(tag)) item.tags.push(tag);
      }
    }

    saveReceipts(storePath, receipts);
    console.log(`"${tags.join(', ')}" zu ${receipt.items.length} Artikel(n) hinzugefügt: ${describeReceipt(receipt)}`);
  } catch (error) {
    if (isExitPromptError(error)) {
      console.log('\nAbgebrochen.');
      return;
    }
    throw error;
  }
}
