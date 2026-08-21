import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const storePath = process.argv[2] ?? undefined;
const server = createServer(storePath);
const transport = new StdioServerTransport();
await server.connect(transport);
