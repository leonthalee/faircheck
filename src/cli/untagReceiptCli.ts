import { confirm, search } from '@inquirer/prompts';
import type { Receipt } from '../types.js';
import { clearReceiptTags } from '../tags.js';
import type { ReceiptStore } from '../storage/receiptStore.js';
import { MAX_SEARCH_RESULTS, describeReceipt, receiptMatches, isExitPromptError } from './receiptDisplay.js';

export async function runUntagReceiptCli(store: ReceiptStore): Promise<void> {
  const receipts = await store.loadReceipts();

  if (receipts.length === 0) {
    console.log(`Keine Belege in "${store.describe()}" gefunden.`);
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
    await store.saveReceipts(receipts);
    console.log(`Tags entfernt: ${describeReceipt(receipt)}`);
  } catch (error) {
    if (isExitPromptError(error)) {
      console.log('\nAbgebrochen.');
      return;
    }
    throw error;
  }
}
