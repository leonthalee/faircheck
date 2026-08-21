import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { loadReceipts } from '../storage/jsonStore.js';
import { computeSplit } from '../split.js';
import { collectTags } from '../tags.js';
import type { Receipt } from '../types.js';

const DEFAULT_STORE = resolve('data/receipts.json');

function getReceipts(storePath?: string): Receipt[] {
  return loadReceipts(storePath ?? DEFAULT_STORE);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtPrice(n: number, currency = 'EUR'): string {
  return `${n.toFixed(2)} ${currency}`;
}

export function createServer(storePath?: string): McpServer {
  const server = new McpServer({
    name: 'faircheck',
    version: '1.0.0',
  });

  // --- Tools ---

  server.tool(
    'list_receipts',
    'List all receipts (date, store, total, item count). Optionally filter by year and/or month.',
    { year: z.number().int().optional(), month: z.number().int().min(1).max(12).optional() },
    async ({ year, month }) => {
      let receipts = getReceipts(storePath);

      if (year !== undefined) {
        receipts = receipts.filter((r) => r.date.getFullYear() === year);
      }
      if (month !== undefined) {
        receipts = receipts.filter((r) => r.date.getMonth() + 1 === month);
      }

      receipts.sort((a, b) => b.date.getTime() - a.date.getTime());

      if (receipts.length === 0) {
        return { content: [{ type: 'text', text: 'No receipts found.' }] };
      }

      const lines = receipts.map(
        (r) =>
          `${fmtDate(r.date)}  ${r.store}${r.label ? ` (${r.label})` : ''}  ${fmtPrice(r.amount, r.currency)}  [${r.items.length} items]  id:${r.id}`,
      );

      return {
        content: [
          {
            type: 'text',
            text: `${receipts.length} receipt(s):\n\n${lines.join('\n')}`,
          },
        ],
      };
    },
  );

  server.tool(
    'get_receipt',
    'Get full details of a single receipt by its ID, including all line items with prices and tags.',
    { receipt_id: z.string() },
    async ({ receipt_id }) => {
      const receipts = getReceipts(storePath);
      const receipt = receipts.find((r) => r.id === receipt_id);

      if (!receipt) {
        return { content: [{ type: 'text', text: `Receipt "${receipt_id}" not found.` }] };
      }

      const header = [
        `Date:    ${fmtDate(receipt.date)}`,
        `Store:   ${receipt.store}${receipt.label ? ` (${receipt.label})` : ''}`,
        `Total:   ${fmtPrice(receipt.amount, receipt.currency)}`,
        receipt.address ? `Address: ${receipt.address}` : null,
        receipt.paymentMethod ? `Payment: ${receipt.paymentMethod}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const itemLines = receipt.items.map((item) => {
        const price = item.price !== null ? fmtPrice(item.price, receipt.currency) : '—';
        const tags = item.tags.length > 0 ? `  [${item.tags.join(', ')}]` : '';
        return `  ${item.name}  ${price}${tags}`;
      });

      return {
        content: [
          {
            type: 'text',
            text: `${header}\n\nItems (${receipt.items.length}):\n${itemLines.join('\n')}`,
          },
        ],
      };
    },
  );

  server.tool(
    'get_spending',
    'Show total spending per month, with receipt count. Optionally filter by year.',
    { year: z.number().int().optional() },
    async ({ year }) => {
      let receipts = getReceipts(storePath);

      if (year !== undefined) {
        receipts = receipts.filter((r) => r.date.getFullYear() === year);
      }

      if (receipts.length === 0) {
        return { content: [{ type: 'text', text: 'No receipts found.' }] };
      }

      const byMonth = new Map<string, { total: number; count: number }>();
      for (const r of receipts) {
        const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
        const entry = byMonth.get(key) ?? { total: 0, count: 0 };
        entry.total += r.amount;
        entry.count += 1;
        byMonth.set(key, entry);
      }

      const sorted = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a));
      const lines = sorted.map(([month, { total, count }]) => `${month}  ${fmtPrice(total)}  (${count} receipts)`);

      const grandTotal = sorted.reduce((sum, [, { total }]) => sum + total, 0);

      return {
        content: [
          {
            type: 'text',
            text: `Spending by month:\n\n${lines.join('\n')}\n\nTotal: ${fmtPrice(grandTotal)}`,
          },
        ],
      };
    },
  );

  server.tool(
    'split_costs',
    'Split costs between participants. Specify the tag used for shared items and one tag per participant. Optionally limit to a single receipt.',
    {
      shared_tag: z.string().describe('Tag that marks shared items (e.g. "gemeinsam")'),
      participants: z.array(z.string()).min(1).describe('Tags identifying each participant (e.g. ["Alice", "Bob"])'),
      receipt_id: z.string().optional().describe('Limit split to a single receipt'),
    },
    async ({ shared_tag, participants, receipt_id }) => {
      let receipts = getReceipts(storePath);

      if (receipt_id !== undefined) {
        receipts = receipts.filter((r) => r.id === receipt_id);
        if (receipts.length === 0) {
          return { content: [{ type: 'text', text: `Receipt "${receipt_id}" not found.` }] };
        }
      }

      const result = computeSplit(receipts, shared_tag, participants);

      const lines = [
        `Shared total: ${fmtPrice(result.sharedTotal)} (per person: ${fmtPrice(result.perPersonShared)})`,
        '',
        ...result.participants.map(
          (p) =>
            `${p}: individual ${fmtPrice(result.individualTotals[p] ?? 0)} + shared ${fmtPrice(result.perPersonShared)} = ${fmtPrice(result.finalTotals[p] ?? 0)}`,
        ),
      ];

      if (result.unassigned.length > 0) {
        lines.push('', `${result.unassigned.length} unassigned item(s):`);
        for (const u of result.unassigned) {
          lines.push(`  ${u.name}  ${u.price !== null ? fmtPrice(u.price) : '—'}`);
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool('list_tags', 'List all tags currently used across all receipts, with usage count.', {}, async () => {
    const receipts = getReceipts(storePath);
    const tags = collectTags(receipts);

    if (tags.size === 0) {
      return { content: [{ type: 'text', text: 'No tags found.' }] };
    }

    const sorted = [...tags.entries()].sort(([, a], [, b]) => b - a);
    const lines = sorted.map(([tag, count]) => `${tag}: ${count}`);

    return { content: [{ type: 'text', text: `Tags (${tags.size}):\n\n${lines.join('\n')}` }] };
  });

  // --- Resources ---

  server.resource('summary', 'faircheck://receipts/summary', async () => {
    const receipts = getReceipts(storePath);

    if (receipts.length === 0) {
      return { contents: [{ uri: 'faircheck://receipts/summary', mimeType: 'text/plain', text: 'No receipts loaded.' }] };
    }

    const sorted = [...receipts].sort((a, b) => a.date.getTime() - b.date.getTime());
    const earliest = sorted[0]!;
    const latest = sorted[sorted.length - 1]!;
    const total = receipts.reduce((s, r) => s + r.amount, 0);
    const totalItems = receipts.reduce((s, r) => s + r.items.length, 0);
    const tags = collectTags(receipts);

    const text = [
      `Faircheck data summary`,
      `Receipts:   ${receipts.length}`,
      `Items:      ${totalItems}`,
      `Period:     ${fmtDate(earliest.date)} – ${fmtDate(latest.date)}`,
      `Total:      ${fmtPrice(total)}`,
      `Tags:       ${tags.size > 0 ? [...tags.keys()].join(', ') : '(none)'}`,
    ].join('\n');

    return { contents: [{ uri: 'faircheck://receipts/summary', mimeType: 'text/plain', text }] };
  });

  return server;
}
