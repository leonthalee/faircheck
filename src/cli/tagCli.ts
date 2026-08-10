import { confirm, input, search } from '@inquirer/prompts';
import type { Receipt, ReceiptItem } from '../types.js';
import { loadReceipts, saveReceipts } from '../storage/jsonStore.js';
import { DEFAULT_STORE_PATH } from './importCli.js';
import { MAX_SEARCH_RESULTS, formatDateTime, isExitPromptError } from './receiptDisplay.js';

interface FlatItem {
  receipt: Receipt;
  item: ReceiptItem;
}

function flattenItems(receipts: Receipt[]): FlatItem[] {
  return receipts.flatMap((receipt) => receipt.items.map((item) => ({ receipt, item })));
}

function describe({ receipt, item }: FlatItem): string {
  const price = item.price !== null ? `${item.price.toFixed(2)} ${receipt.currency}` : '–';
  const tags = item.tags.length > 0 ? ` [${item.tags.join(', ')}]` : '';
  return `${formatDateTime(receipt.date)} ${receipt.store} — ${item.name} (${price})${tags}`;
}

export async function runTagCli(args: string[]): Promise<void> {
  const storePath = args[0] ?? DEFAULT_STORE_PATH;
  const receipts = loadReceipts(storePath);

  if (receipts.length === 0) {
    console.log(`Keine Belege in "${storePath}" gefunden. Erst importieren:`);
    console.log(`  npm run cli -- import <csv-datei> ${storePath}`);
    return;
  }

  const items = flattenItems(receipts);
  console.log(`${receipts.length} Beleg(e), ${items.length} Artikel geladen aus "${storePath}".`);

  try {
    for (;;) {
      const selected = await search<FlatItem>({
        message: 'Artikel suchen (Name oder Geschäft eingeben, leer = alle)',
        source: async (term) => {
          const needle = (term ?? '').trim().toLowerCase();
          const matches =
            needle === ''
              ? items
              : items.filter(
                  (flat) =>
                    flat.item.name.toLowerCase().includes(needle) ||
                    flat.receipt.store.toLowerCase().includes(needle),
                );
          return matches.slice(0, MAX_SEARCH_RESULTS).map((flat) => ({ name: describe(flat), value: flat }));
        },
      });

      const currentTags = selected.item.tags.join(', ');
      const answer = await input({
        message: `Tags für "${selected.item.name}" (kommagetrennt)`,
        default: currentTags,
      });

      selected.item.tags = answer
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '');

      saveReceipts(storePath, receipts);
      console.log(`Gespeichert: ${describe(selected)}`);

      const again = await confirm({ message: 'Weiteren Artikel taggen?', default: true });
      if (!again) break;
    }
  } catch (error) {
    if (isExitPromptError(error)) {
      console.log('\nAbgebrochen.');
      return;
    }
    throw error;
  }

  console.log('Fertig.');
}
