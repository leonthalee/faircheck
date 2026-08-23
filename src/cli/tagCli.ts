import { confirm, input, search } from '@inquirer/prompts';
import type { Receipt, ReceiptItem } from '../types.js';
import type { ReceiptStore } from '../storage/receiptStore.js';
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

export async function runTagCli(store: ReceiptStore): Promise<void> {
  // Loaded once and held for the whole session: `flattenItems` hands out live
  // references into this array, and every save below writes it back. Reloading
  // inside the loop would detach those references — the next edit would then be
  // applied to an orphaned object and saved from a stale snapshot, losing data
  // silently.
  const receipts = await store.loadReceipts();

  if (receipts.length === 0) {
    console.log(`Keine Belege in "${store.describe()}" gefunden. Erst importieren:`);
    console.log('  npm run cli -- import <csv-datei>');
    return;
  }

  const items = flattenItems(receipts);
  console.log(`${receipts.length} Beleg(e), ${items.length} Artikel geladen aus "${store.describe()}".`);

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

      await store.saveReceipts(receipts);
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
