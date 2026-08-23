import path from 'node:path';
import { existsSync } from 'node:fs';

export const DEFAULT_STORE_PATH = path.join('data', 'receipts.json');

export type StoreConfig =
  | { kind: 'json'; filePath: string }
  | { kind: 'mongo'; uri: string; dbName: string | undefined };

let envLoaded = false;

/**
 * Reads `.env` if present. Node has done this natively since 20.12, so this
 * needs no dependency. Called lazily so importing this module has no side
 * effect of its own.
 */
function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;
  if (existsSync('.env')) process.loadEnvFile('.env');
}

/**
 * Decides which backend to use, in this order:
 *
 *   1. an explicit store path argument — always the JSON file
 *   2. `FAIRCHECK_STORE=json|mongo` — forces that backend
 *   3. `MONGODB_URI` set — MongoDB; otherwise the JSON file
 *
 * Rule 1 exists so the documented `npm run cli -- tag ./other.json` keeps
 * meaning that file even when a database is configured in `.env`.
 */
export function resolveStoreConfig(pathArg?: string | undefined): StoreConfig {
  ensureEnvLoaded();

  if (pathArg !== undefined && pathArg !== '') {
    return { kind: 'json', filePath: pathArg };
  }

  const forced = process.env['FAIRCHECK_STORE'];
  if (forced !== undefined && forced !== 'json' && forced !== 'mongo') {
    throw new Error(`Unbekannter Wert für FAIRCHECK_STORE: "${forced}" (erlaubt: json, mongo)`);
  }

  const uri = process.env['MONGODB_URI'];
  const wantsMongo = forced === 'mongo' || (forced === undefined && uri !== undefined && uri !== '');

  if (wantsMongo) {
    if (uri === undefined || uri === '') {
      throw new Error('FAIRCHECK_STORE=mongo gesetzt, aber MONGODB_URI fehlt.');
    }
    return { kind: 'mongo', uri, dbName: process.env['MONGODB_DB'] };
  }

  return { kind: 'json', filePath: process.env['FAIRCHECK_STORE_PATH'] ?? DEFAULT_STORE_PATH };
}
