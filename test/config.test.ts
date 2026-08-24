import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveStoreConfig, DEFAULT_STORE_PATH } from '../src/config.js';

const VARS = ['MONGODB_URI', 'MONGODB_DB', 'FAIRCHECK_STORE', 'FAIRCHECK_STORE_PATH'] as const;

// resolveStoreConfig reads .env lazily, on its first call. Without this, that
// read would land in the middle of the first test — after beforeEach had
// cleared the environment — and repopulate it from whatever .env the developer
// happens to have. Triggering it once up front makes these tests independent
// of that file; otherwise they pass on a fresh clone and fail on a machine
// that is configured for MongoDB.
before(() => {
  resolveStoreConfig();
});

beforeEach(() => {
  for (const name of VARS) delete process.env[name];
});

test('falls back to the default JSON file when nothing is configured', () => {
  assert.deepEqual(resolveStoreConfig(), { kind: 'json', filePath: DEFAULT_STORE_PATH });
});

test('an explicit path argument always wins, even with MongoDB configured', () => {
  process.env['MONGODB_URI'] = 'mongodb://localhost:27017';
  assert.deepEqual(resolveStoreConfig('other.json'), { kind: 'json', filePath: 'other.json' });
});

test('MONGODB_URI alone selects MongoDB', () => {
  process.env['MONGODB_URI'] = 'mongodb://localhost:27017';
  process.env['MONGODB_DB'] = 'faircheck';
  assert.deepEqual(resolveStoreConfig(), {
    kind: 'mongo',
    uri: 'mongodb://localhost:27017',
    dbName: 'faircheck',
  });
});

test('FAIRCHECK_STORE=json forces the file even when MONGODB_URI is set', () => {
  process.env['MONGODB_URI'] = 'mongodb://localhost:27017';
  process.env['FAIRCHECK_STORE'] = 'json';
  assert.deepEqual(resolveStoreConfig(), { kind: 'json', filePath: DEFAULT_STORE_PATH });
});

test('FAIRCHECK_STORE_PATH overrides the default file location', () => {
  process.env['FAIRCHECK_STORE_PATH'] = path.join('anderswo', 'store.json');
  assert.deepEqual(resolveStoreConfig(), {
    kind: 'json',
    filePath: path.join('anderswo', 'store.json'),
  });
});

test('FAIRCHECK_STORE=mongo without a URI fails loudly instead of silently using the file', () => {
  process.env['FAIRCHECK_STORE'] = 'mongo';
  assert.throws(() => resolveStoreConfig(), /MONGODB_URI/);
});

test('an unknown FAIRCHECK_STORE value is rejected', () => {
  process.env['FAIRCHECK_STORE'] = 'postgres';
  assert.throws(() => resolveStoreConfig(), /FAIRCHECK_STORE/);
});
