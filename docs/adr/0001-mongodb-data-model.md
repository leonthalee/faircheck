# 1. MongoDB data model

Status: accepted

## Context

Faircheck stored receipts in a single JSON file. That works for one person on
one machine, but it caps the application: every read loads the whole file,
every write rewrites it, and there is no way to ask a question of the data
without pulling all of it into the process first.

Receipts are a document-shaped domain — a receipt owns its line items, is
always read as a whole, and never shares them with anything else — so a
document database is a natural fit rather than a fashionable one. This record
covers how the data is modelled; the store abstraction that lets both backends
coexist is a separate concern, decided in `src/storage/receiptStore.ts`.

## Decision

### The receipt id is `_id`

Receipt ids come from the source export (`OV2ECTAWX5G37SGg4xXg`) and are already
the identity `mergeReceipts` matches on. Reusing them as `_id`:

- gets the uniqueness constraint and the primary index for free, with no second
  index over a duplicate `id` field;
- makes every upsert idempotent (`replaceOne({_id}, doc, {upsert: true})`),
  which is exactly what re-importing a CSV and the migration script need;
- means the application's notion of identity and the database's are the same
  thing, so there is no dual-key bookkeeping.

What this gives up: `ObjectId`'s insertion locality (irrelevant at this scale)
and its embedded creation timestamp (`date` is the timestamp that matters
here). An id can never change without a delete-and-insert — acceptable, because
ids come from an upstream system and do not change.

### Line items stay embedded

`items` is an array of subdocuments inside the receipt, not a second collection.

1. **Access pattern.** Items are never read, written or deleted independently
   of their receipt. Every operation — display, tag, untag, split, delete —
   starts from a receipt or sweeps all of them. Embedding makes that one round
   trip with no join.
2. **Bounded cardinality.** A receipt has tens of items and a few KB of BSON.
   This is the textbook one-to-few case; the 16 MB document limit is three
   orders of magnitude away.
3. **Atomicity.** Because the aggregate is one document, every write the
   application performs is a single-document operation, and MongoDB guarantees
   those atomically. **No multi-document transactions are needed, and therefore
   no replica set.**
4. **Lifecycle.** Items die with their receipt. Normalising would mean
   cascading deletes in application code or orphan cleanup.

This would flip if items had to grow without bound, or had to be queried and
updated at volume independently of their parent. Neither is true here.

Tags follow the same reasoning: a bounded set of free-text strings on each
item, queryable through a multikey index and countable with an aggregation. A
tag entity would add a join and buy nothing.

### Three indexes, and the ones deliberately missing

| Index | Serves |
|---|---|
| `{ date: -1 }` | monthly spending ranges, and the newest-first order every list view uses |
| `{ 'items.tags': 1 }` (multikey) | filtering items by tag when splitting costs |
| `{ 'items.id': 1 }` (multikey) | addressing a single item for a targeted update |

Measured on a synthetic collection of 20,002 receipts, querying
`{ "items.tags": "gemeinsam" }` with 42 matches:

| | without index | with index |
|---|---|---|
| plan | `COLLSCAN` | `FETCH → IXSCAN` |
| documents examined | 20,002 | 42 |

Notes worth keeping: the direction of a single-field index is cosmetic —
MongoDB walks it either way, and direction only matters in compound indexes. A
multikey index stores one entry per array element, which is what turns the tag
query into a seek. `{ 'items.id': 1 }` is **not** unique: item ids are
`${receiptId}:${index}` and therefore unique by construction, so a unique index
would enforce nothing new while adding a way for re-imports to fail.

No index on `store`: nothing queries by it — the interactive search filters an
already-loaded list in memory. Every index costs write throughput, working-set
memory and disk, so the rule is no index without a query.

`_id` needs no entry, which is half the reason for the decision above.

### Dates are BSON dates

`date` maps to the native BSON date type — a signed 64-bit millisecond offset
from the epoch, structurally the same thing a JS `Date` is. The driver converts
in both directions, so the JSON store's manual `new Date(r.date)` revival step
disappears.

This is the concrete answer to "why not keep the file": date ranges execute in
the database and are index-backed, and a monthly breakdown can be an
aggregation instead of loading every receipt into Node. A date stored as a JSON
string can only be range-queried by lexicographic accident.

### Nulls are stored explicitly

The domain uses `null` for absent values, and documents keep those fields
rather than omitting them. That is what lets a document round-trip into a
receipt that deep-equals the original, which the conformance suite asserts for
both backends with a single comparison.

## Consequences

- **A single node is enough.** No replica set, so `docker-compose.yml` stays a
  dozen lines. A replica set would only be needed for multi-document
  transactions or change streams — the latter would become interesting if the
  web UI ever wanted live updates, and that is the point at which to revisit.
- **Amounts are stored as `double`, which is wrong for money.** MongoDB's
  answer is `Decimal128`. It is deliberately out of scope here: `src/split.ts`
  does floating-point arithmetic throughout and the frontend formats with
  `toFixed(2)`, so converting is an orthogonal change with its own test
  surface. Recorded as a known limitation rather than silently accepted.
- **No tenant key.** The model assumes one user's data. Multi-user would mean a
  `userId` field and compound indexes like `{ userId: 1, date: -1 }` — noted,
  not built.
- **Index creation happens at application startup**, which is idempotent and
  fine at this size. At production scale it belongs in a deploy step so that
  starting an instance cannot trigger an index build.
