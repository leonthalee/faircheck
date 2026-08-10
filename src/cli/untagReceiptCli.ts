import { confirm, search } from '@inquirer/prompts';
import type { Receipt } from '../types.js';
import { loadReceipts, saveReceipts } from '../storage/jsonStore.js';
import { clearReceiptTags } from '../tags.js';
import { DEFAULT_STORE_PATH } from './importCli.js';
import { MAX_SEARCH_RESULTS, describeReceipt, receiptMatches, isExitPromptError } from './receiptDisplay.js';

export async function runUntagReceiptCli(args: string[]): Promise<void> {
  const storePath = args[0] ?? DEFAULT_STORE_PATH;
  const receipts = loadReceipts(storePath);

  if (receipts.length === 0) {
    console.log(`Keine Belege in "${storePath}" gefunden.`);
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

    const proceed = await confirm({
      message: `Wirklich ALLE Tags von allen ${receipt.items.length} Artikeln entfernen? (${describeReceipt(receipt)})`,
      default: false,
    });
    if (!proceed) {
      console.log('Abgebrochen.');
      return;
    }

    clearReceiptTags(receipts, receipt.id);
    saveReceipts(storePath, receipts);
    console.log(`Tags entfernt: ${describeReceipt(receipt)}`);
  } catch (error) {
    if (isExitPromptError(error)) {
      console.log('\nAbgebrochen.');
      return;
    }
    throw error;
  }
}
