import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/mcp/server.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function setup() {
  const server = createServer('data/receipts.json');
  const client = new Client({ name: 'test', version: '0.1' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { server, client };
}

describe('MCP server', () => {
  it('lists all 5 tools', async () => {
    const { server, client } = await setup();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepStrictEqual(names, ['get_receipt', 'get_spending', 'list_receipts', 'list_tags', 'split_costs']);
    await client.close();
    await server.close();
  });

  it('list_receipts returns all receipts', async () => {
    const { server, client } = await setup();
    const res = await client.callTool({ name: 'list_receipts', arguments: {} });
    const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    assert.ok(text.includes('receipt(s)'));
    assert.ok(text.includes('REWE'));
    await client.close();
    await server.close();
  });

  it('get_receipt returns item details', async () => {
    const { server, client } = await setup();
    // First get a receipt ID from list
    const listRes = await client.callTool({ name: 'list_receipts', arguments: {} });
    const listText = (listRes.content as Array<{ type: string; text: string }>)[0]!.text;
    const idMatch = listText.match(/id:(\S+)/);
    assert.ok(idMatch, 'should find a receipt id');

    const res = await client.callTool({ name: 'get_receipt', arguments: { receipt_id: idMatch[1] } });
    const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    assert.ok(text.includes('Items ('));
    await client.close();
    await server.close();
  });

  it('get_spending returns monthly breakdown', async () => {
    const { server, client } = await setup();
    const res = await client.callTool({ name: 'get_spending', arguments: {} });
    const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    assert.ok(text.includes('Spending by month'));
    assert.ok(text.includes('Total:'));
    await client.close();
    await server.close();
  });

  it('list_tags returns tag counts', async () => {
    const { server, client } = await setup();
    const res = await client.callTool({ name: 'list_tags', arguments: {} });
    const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    assert.ok(text.includes('Tags') || text.includes('No tags'));
    await client.close();
    await server.close();
  });

  it('split_costs computes a split', async () => {
    const { server, client } = await setup();
    const res = await client.callTool({
      name: 'split_costs',
      arguments: { shared_tag: 'gemeinsam', participants: ['Alice', 'Bob'] },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    assert.ok(text.includes('Alice:'));
    assert.ok(text.includes('Bob:'));
    await client.close();
    await server.close();
  });

  it('exposes the summary resource', async () => {
    const { server, client } = await setup();
    const { resources } = await client.listResources();
    assert.ok(resources.some((r) => r.uri === 'faircheck://receipts/summary'));

    const summary = await client.readResource({ uri: 'faircheck://receipts/summary' });
    const text = (summary.contents as Array<{ uri: string; text: string }>)[0]!.text;
    assert.ok(text.includes('Receipts:'));
    assert.ok(text.includes('Total:'));
    await client.close();
    await server.close();
  });
});
