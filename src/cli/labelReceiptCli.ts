import { input, search } from '@inquirer/prompts';
import type { Receipt } from '../types.js';
import { loadReceipts, saveReceipts } from '../storage/jsonStore.js';
import { setReceiptLabel } from '../tags.js';
import { DEFAULT_STORE_PATH } from './importCli.js';
import { MAX_SEARCH_RESULTS, describeReceipt, receiptMatches, isExitPromptError } from './receiptDisplay.js';

export async function runLabelReceiptCli(args: string[]): Promise<void> {
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

    const answer = await input({
      message: `Eigener Name für "${describeReceipt(receipt)}" (leer lassen zum Entfernen)`,
      default: receipt.label ?? '',
    });

    const label = answer.trim() === '' ? null : answer.trim();
    setReceiptLabel(receipts, receipt.id, label);
    saveReceipts(storePath, receipts);
    console.log(label ? `Name gesetzt: "${label}"` : 'Name entfernt.');
  } catch (error) {
    if (isExitPromptError(error)) {
      console.log('\nAbgebrochen.');
      return;
    }
    throw error;
  }
}
