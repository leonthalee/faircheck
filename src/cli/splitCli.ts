import { checkbox, search, select } from '@inquirer/prompts';
import type { Receipt } from '../types.js';
import { loadReceipts } from '../storage/jsonStore.js';
import { collectTags } from '../tags.js';
import { computeSplit } from '../split.js';
import { DEFAULT_STORE_PATH } from './importCli.js';
import { MAX_SEARCH_RESULTS, describeReceipt, receiptMatches, isExitPromptError } from './receiptDisplay.js';

const UNASSIGNED_PREVIEW_LIMIT = 20;

// item.price is negative for expenses (matching the source CSV), so flip the
// sign here to show a positive "was zu zahlen ist" amount.
function formatAmount(signed: number): string {
  return (-signed).toFixed(2);
}

export async function runSplitCli(args: string[]): Promise<void> {
  const storePath = args[0] ?? DEFAULT_STORE_PATH;
  const receipts = loadReceipts(storePath);

  if (receipts.length === 0) {
    console.log(`Keine Belege in "${storePath}" gefunden. Erst importieren.`);
    return;
  }

  try {
    const scope = await search<Receipt | null>({
      message: 'Auf welchen Bereich beziehen? (Geschäft eingeben zum Filtern, leer = Alle Belege oben)',
      source: async (term) => {
        const needle = (term ?? '').trim().toLowerCase();
        const matches = needle === '' ? receipts : receipts.filter((r) => receiptMatches(r, needle));
        const receiptChoices = matches
          .slice(0, MAX_SEARCH_RESULTS)
          .map((r) => ({ name: describeReceipt(r), value: r }));
        if (needle === '' || 'alle belege'.includes(needle)) {
          return [{ name: 'Alle Belege', value: null }, ...receiptChoices];
        }
        return receiptChoices;
      },
    });

    const scopedReceipts = scope ? [scope] : receipts;

    const tagCounts = collectTags(scopedReceipts);
    if (tagCounts.size === 0) {
      console.log('Für diesen Bereich sind noch keine Tags vergeben. Erst mit "tag" oder "tag-receipt" taggen.');
      return;
    }

    const tagChoices = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ name: `${tag} (${count} Artikel)`, value: tag }));

    const sharedTag = await select<string>({
      message: 'Welcher Tag steht für gemeinsame Kosten?',
      choices: tagChoices,
    });

    const participants = await checkbox<string>({
      message: 'Welche Tags sind die Personen? (Leertaste zum Auswählen, Enter zum Bestätigen)',
      choices: tagChoices.filter((choice) => choice.value !== sharedTag),
      validate: (selected) => (selected.length > 0 ? true : 'Mindestens eine Person auswählen.'),
    });

    const result = computeSplit(scopedReceipts, sharedTag, participants);

    console.log('');
    console.log(`Für: ${scope ? describeReceipt(scope) : 'Alle Belege'}`);
    console.log(`Gemeinsame Kosten ("${sharedTag}"): ${formatAmount(result.sharedTotal)} EUR`);
    console.log(`  -> Anteil pro Person (${participants.length}): ${formatAmount(result.perPersonShared)} EUR`);
    console.log('');
    for (const person of participants) {
      const individual = formatAmount(result.individualTotals[person] ?? 0);
      const total = formatAmount(result.finalTotals[person] ?? 0);
      console.log(
        `${person}: ${total} EUR  (eigene Artikel: ${individual} EUR + Anteil gemeinsam: ${formatAmount(result.perPersonShared)} EUR)`,
      );
    }

    if (result.unassigned.length > 0) {
      console.log('');
      console.log(
        `Achtung: ${result.unassigned.length} Artikel haben weder "${sharedTag}" noch einen Personen-Tag und wurden NICHT mitgerechnet:`,
      );
      for (const item of result.unassigned.slice(0, UNASSIGNED_PREVIEW_LIMIT)) {
        console.log(`  - ${item.name} (${item.price?.toFixed(2) ?? '–'})`);
      }
      if (result.unassigned.length > UNASSIGNED_PREVIEW_LIMIT) {
        console.log(`  ... und ${result.unassigned.length - UNASSIGNED_PREVIEW_LIMIT} weitere`);
      }
    }
  } catch (error) {
    if (isExitPromptError(error)) {
      console.log('\nAbgebrochen.');
      return;
    }
    throw error;
  }
}
