import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { loadReceipts, saveReceipts } from '../storage/jsonStore.js';
import { parseReceiptsCsv } from '../csv/parseReceipts.js';
import { mergeReceipts, setItemTags, setReceiptLabel, clearReceiptTags, deleteReceipt, collectTags } from '../tags.js';
import { computeSplit } from '../split.js';

export function createServer(storePath: string) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use(express.text({ type: 'text/csv', limit: '20mb' }));
  app.use(express.static(path.join(import.meta.dirname, 'public')));

  app.get('/api/receipts', (_req: Request, res: Response) => {
    res.json(loadReceipts(storePath));
  });

  app.get('/api/tags', (_req: Request, res: Response) => {
    const receipts = loadReceipts(storePath);
    const counts = collectTags(receipts);
    const tags = [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    res.json(tags);
  });

  app.post('/api/import', (req: Request, res: Response) => {
    const csvContent = typeof req.body === 'string' ? req.body : undefined;
    if (!csvContent) {
      res.status(400).json({ error: 'CSV-Inhalt fehlt (Content-Type: text/csv erwartet)' });
      return;
    }

    const fresh = parseReceiptsCsv(csvContent);
    const existing = loadReceipts(storePath);
    const merged = mergeReceipts(fresh, existing);
    saveReceipts(storePath, merged);
    res.json(merged);
  });

  app.put('/api/items/:itemId/tags', (req: Request, res: Response) => {
    const itemId = String(req.params['itemId'] ?? '');
    const rawTags = req.body?.tags;
    if (!Array.isArray(rawTags)) {
      res.status(400).json({ error: 'tags muss ein Array sein' });
      return;
    }

    const tags = rawTags.map((tag) => String(tag).trim()).filter((tag) => tag !== '');
    const receipts = loadReceipts(storePath);
    const ok = setItemTags(receipts, itemId, tags);
    if (!ok) {
      res.status(404).json({ error: 'Item nicht gefunden' });
      return;
    }

    saveReceipts(storePath, receipts);
    res.json({ ok: true });
  });

  app.post('/api/receipts/:receiptId/tags', (req: Request, res: Response) => {
    const receiptId = String(req.params['receiptId'] ?? '');
    const rawTags = req.body?.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.map((tag) => String(tag).trim()).filter((tag) => tag !== '')
      : [];

    if (tags.length === 0) {
      res.status(400).json({ error: 'Mindestens ein Tag angeben' });
      return;
    }

    const receipts = loadReceipts(storePath);
    const receipt = receipts.find((r) => r.id === receiptId);
    if (!receipt) {
      res.status(404).json({ error: 'Beleg nicht gefunden' });
      return;
    }

    for (const item of receipt.items) {
      for (const tag of tags) {
        if (!item.tags.includes(tag)) item.tags.push(tag);
      }
    }

    saveReceipts(storePath, receipts);
    res.json(receipt);
  });

  app.put('/api/receipts/:receiptId/label', (req: Request, res: Response) => {
    const receiptId = String(req.params['receiptId'] ?? '');
    const rawLabel = req.body?.label;
    const label = typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel.trim() : null;

    const receipts = loadReceipts(storePath);
    const ok = setReceiptLabel(receipts, receiptId, label);
    if (!ok) {
      res.status(404).json({ error: 'Beleg nicht gefunden' });
      return;
    }

    saveReceipts(storePath, receipts);
    res.json(receipts.find((r) => r.id === receiptId));
  });

  app.delete('/api/receipts/:receiptId/tags', (req: Request, res: Response) => {
    const receiptId = String(req.params['receiptId'] ?? '');
    const receipts = loadReceipts(storePath);
    const ok = clearReceiptTags(receipts, receiptId);
    if (!ok) {
      res.status(404).json({ error: 'Beleg nicht gefunden' });
      return;
    }

    saveReceipts(storePath, receipts);
    res.json(receipts.find((r) => r.id === receiptId));
  });

  app.delete('/api/receipts/:receiptId', (req: Request, res: Response) => {
    const receiptId = String(req.params['receiptId'] ?? '');
    const receipts = loadReceipts(storePath);
    const ok = deleteReceipt(receipts, receiptId);
    if (!ok) {
      res.status(404).json({ error: 'Beleg nicht gefunden' });
      return;
    }

    saveReceipts(storePath, receipts);
    res.json({ ok: true });
  });

  app.post('/api/split', (req: Request, res: Response) => {
    const sharedTag = req.body?.sharedTag;
    const participants = req.body?.participants;
    const receiptId = req.body?.receiptId;
    if (typeof sharedTag !== 'string' || !Array.isArray(participants) || participants.length === 0) {
      res.status(400).json({ error: 'sharedTag (string) und participants (nicht-leeres Array) erforderlich' });
      return;
    }

    let receipts = loadReceipts(storePath);
    if (typeof receiptId === 'string' && receiptId !== '') {
      const receipt = receipts.find((r) => r.id === receiptId);
      if (!receipt) {
        res.status(404).json({ error: 'Beleg nicht gefunden' });
        return;
      }
      receipts = [receipt];
    }

    const result = computeSplit(receipts, sharedTag, participants);
    res.json(result);
  });

  return app;
}
