import { runImport } from './cli/importCli.js';
import { runTagCli } from './cli/tagCli.js';
import { runTagReceiptCli } from './cli/tagReceiptCli.js';
import { runUntagReceiptCli } from './cli/untagReceiptCli.js';
import { runLabelReceiptCli } from './cli/labelReceiptCli.js';
import { runDeleteReceiptCli } from './cli/deleteReceiptCli.js';
import { runSplitCli } from './cli/splitCli.js';
import { runServe } from './cli/serveCli.js';

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'import':
      runImport(rest);
      break;
    case 'tag':
      await runTagCli(rest);
      break;
    case 'tag-receipt':
      await runTagReceiptCli(rest);
      break;
    case 'untag-receipt':
      await runUntagReceiptCli(rest);
      break;
    case 'label-receipt':
      await runLabelReceiptCli(rest);
      break;
    case 'delete-receipt':
      await runDeleteReceiptCli(rest);
      break;
    case 'split':
      await runSplitCli(rest);
      break;
    case 'serve':
      runServe(rest);
      break;
    default:
      console.log('Verwendung:');
      console.log('  cli import <csv-datei> [store-datei]   CSV importieren/mergen (Tags bleiben erhalten)');
      console.log('  cli tag [store-datei]                  Interaktiv Tags für ein einzelnes Item vergeben');
      console.log('  cli tag-receipt [store-datei]          Tag(s) zu allen Items eines Belegs hinzufügen');
      console.log('  cli untag-receipt [store-datei]        Alle Tags von allen Items eines Belegs entfernen');
      console.log('  cli label-receipt [store-datei]        Eigenen Namen für einen Beleg setzen');
      console.log('  cli delete-receipt [store-datei]       Einen Beleg komplett löschen');
      console.log('  cli split [store-datei]                Kosten pro Person aufteilen (gemeinsam + individuell)');
      console.log('  cli serve [store-datei] [port]         Lokale Weboberfläche starten (Default-Port 3000)');
      process.exitCode = command ? 1 : 0;
  }
}

main();
