# Faircheck

Parses CSV receipt exports (from a receipt-scanning app), lets you tag individual line items, and splits costs between people — as both a CLI and a local web UI, sharing one store. Runs on a local JSON file by default, or on MongoDB.

*Not affiliated with or endorsed by epap.*

![Belege & Tags: Items mit Tags "gemeinsam", "Alice", "Bob"](docs/screenshots/belege-tags.png)

![Kosten aufteilen: Beispielrechnung mit Alice und Bob](docs/screenshots/kosten-aufteilen.png)

![Kalender: Tage mit Einkäufen](docs/screenshots/kalender.png)

![Ausgaben: monatliche Aufschlüsselung](docs/screenshots/ausgaben.png)

## Warum

Receipt-scanning apps that export a full purchase history as CSV tend to encode each receipt's line items as a single pipe-delimited string (`Name|Kategorie|Preis|...`) rather than proper rows — fine for the app itself, painful to work with by hand. This project parses that format into a clean data model, then adds what the export doesn't provide: tagging items (e.g. "shared", "person A"), and splitting the resulting costs between people.

## Features

- **CSV import**, merged by receipt ID — re-importing a full export (which always contains the entire history) adds new receipts without touching or duplicating existing ones, and preserves tags already assigned
- **Tagging**: per item, bulk per receipt, or cleared per receipt — with a free-text label per receipt (useful when two receipts from the same store land on the same day)
- **Cost splitting**: pick a "shared" tag and one tag per person, get an even split of shared costs plus each person's individually-tagged items — scoped to a single receipt or aggregated across all of them
- **Calendar view**: which days had purchases, click through to the receipt
- **Spending overview**: totals per month
- **CLI and local web UI**, both operating on the same store — use whichever fits, switch anytime
- **Two storage backends** behind one interface: a local JSON file (the default, no setup) or MongoDB — selected by configuration, with no change to the rest of the application
- **MCP server** ([Model Context Protocol](https://modelcontextprotocol.io/)): exposes receipts, spending, tags, and cost-splitting as tools that any MCP-compatible AI assistant (Claude Desktop, Claude Code, …) can call — same core library, no duplication

## Tech stack

- TypeScript (Node.js), strict mode
- [Express](https://expressjs.com/) for the web server
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) for the interactive CLI
- [csv-parse](https://csv.js.org/parse/) for CSV parsing
- [mongodb](https://www.mongodb.com/docs/drivers/node/current/) as an optional storage backend, with Docker Compose for local development
- Plain HTML/CSS/JS frontend — no framework, no build step
- [tsx](https://github.com/privatenumber/tsx) to run TypeScript directly
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) for the MCP server

## Getting started

```bash
npm install

# Import a CSV export
npm run cli -- import path/to/export.csv

# Interactive CLI
npm run cli -- tag
npm run cli -- split

# Local web UI (http://localhost:3000)
npm run web

# MCP server (for Claude Desktop, Claude Code, etc.)
npm run mcp

# Tests
npm test
```

### MCP server

The MCP server exposes Faircheck's core library as tools that an AI assistant can call directly — no separate API, no duplication of logic.

**Tools:** `list_receipts`, `get_receipt`, `get_spending`, `split_costs`, `list_tags` (all read-only).
**Resources:** `faircheck://receipts/summary` — a compact overview of the data store.

To use it with Claude Desktop, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "faircheck": {
      "command": "npx",
      "args": ["tsx", "src/mcp/index.ts"],
      "cwd": "/path/to/faircheck"
    }
  }
}
```

Then ask Claude things like *"Was habe ich im Juli ausgegeben?"* or *"Teile die Kosten zwischen Alice und Bob auf."*

The MCP server picks its backend the same way everything else does. Since `cwd` points at the project, a `.env` there is picked up automatically — so a MongoDB-backed setup needs no extra configuration here.

## Storage

Everything runs on a local JSON file out of the box — no database, no setup. MongoDB is opt-in.

Which backend is used is decided at startup, in this order:

| | Result |
|---|---|
| An explicit store path argument (`npm run cli -- tag ./other.json`) | always that JSON file |
| `FAIRCHECK_STORE=json` or `=mongo` | forces that backend |
| `MONGODB_URI` is set | MongoDB |
| nothing set | JSON file at `data/receipts.json` |

Configuration comes from the environment or a `.env` file — see [`.env.example`](.env.example). The first rule exists so an explicit path keeps meaning that file even with a database configured, which is handy for keeping separate stores side by side.

### MongoDB

A `docker-compose.yml` is included, so a local instance is one command:

```bash
docker compose up -d          # start
cp .env.example .env          # then uncomment the local MONGODB_URI
npm run cli -- import fixtures/sample.csv

docker compose down           # stop, keep the data
docker compose down -v        # stop and delete the data
```

The same code path works against a hosted instance such as MongoDB Atlas — only the connection string changes. Never commit one with real credentials in it; `.env` is gitignored for that reason.

Receipts are stored as one document each, with line items embedded, and the receipt id from the export as `_id`. The reasoning behind that — and behind the indexes, and what is deliberately left unsolved — is in [`docs/adr/0001-mongodb-data-model.md`](docs/adr/0001-mongodb-data-model.md).

The MongoDB tests skip themselves unless `MONGODB_TEST_URI` is set, so `npm test` passes on a fresh clone with no database running.

## Architecture

The core logic (`src/`: CSV parsing, tagging, cost-splitting) is a plain TypeScript library with no dependency on any interface. The CLI (`src/cli/`), the web server (`src/web/`), and the MCP server (`src/mcp/`) are all thin layers on top of it — so features only need to be built once at the library level and then wired into whichever interface makes sense.

Storage sits behind a `ReceiptStore` interface (`src/storage/`), with a JSON file and MongoDB as interchangeable implementations. Nothing outside `src/storage/` knows which one it is talking to, and a single conformance test suite runs against both to keep them honest.

## License

MIT — see [LICENSE](LICENSE).
