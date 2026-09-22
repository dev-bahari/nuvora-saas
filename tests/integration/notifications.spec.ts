/**
 * Integration tests — Notificaciones (Task 12)
 *
 * Test matrix:
 *   1. Crear canal WEBHOOK → persiste en notification_channels
 *   2. dispatch() sobre evento coincidente → notification_log SENT
 *   3. Canal sin ese evento → no se dispara (notification_log vacío)
 *   4. WEBHOOK body contiene HMAC-SHA256 header cuando hay secret
 *   5. notification_log append-only: trigger rechaza UPDATE
 *   6. RLS: tenant B no ve canales ni logs de tenant A
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import http from 'node:http';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { NotificationsService } from '../../apps/api/src/notifications/notifications.service.js';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Notifications Integration Tests (Task 12)', () => {
  let pool: pg.Pool;
  let notifications: NotificationsService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let ctxA: RequestContext;
  let ctxB: RequestContext;

  // Minimal HTTP server to receive webhook calls in tests
  let webhookServer: http.Server;
  let webhookPort: number;
  let lastWebhookBody: string | null = null;
  let lastWebhookHeaders: Record<string, string | string[] | undefined> = {};

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });
    await runMigrations(pool);
    notifications = new NotificationsService(pool);

    // Start a local HTTP server to capture webhook payloads
    await new Promise<void>((resolve) => {
      webhookServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          lastWebhookBody = body;
          lastWebhookHeaders = { ...req.headers } as Record<string, string | string[] | undefined>;
          res.writeHead(200);
          res.end();
        });
      });
      webhookServer.listen(0, '127.0.0.1', () => {
        const addr = webhookServer.address() as { port: number };
        webhookPort = addr.port;
        resolve();
      });
    });

    const client = await pool.connect();
    try {
      const ts = Date.now();
      const { rows: [tA] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Notif Tenant A', 'notif-a-${ts}') RETURNING id`,
      );
      const { rows: [tB] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Notif Tenant B', 'notif-b-${ts}') RETURNING id`,
      );
      const { rows: [uA] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('notif-a-${ts}@t.com', 'A', 'x') RETURNING id`,
      );
      const { rows: [uB] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('notif-b-${ts}@t.com', 'B', 'x') RETURNING id`,
      );
      tenantAId = tA!.id;
      tenantBId = tB!.id;
      userAId = uA!.id;
      userBId = uB!.id;
    } finally {
      client.release();
    }

    ctxA = { tenantId: tenantAId, userId: userAId, permissions: ['notifications.manage'], requestId: 'notif-a' };
    ctxB = { tenantId: tenantBId, userId: userBId, permissions: ['notifications.manage'], requestId: 'notif-b' };
  });

  afterAll(async () => {
    webhookServer.close();
    await pool.end();
  });

  it('crear canal WEBHOOK persiste en DB', async () => {
    const ch = await notifications.createChannel(ctxA, {
      channelType: 'WEBHOOK',
      config: { url: `http://127.0.0.1:${webhookPort}`, secret: 'topsecret' },
      events: ['invoice.issued'],
    });

    expect(ch.id).toBeDefined();
    expect(ch.channelType).toBe('WEBHOOK');

    const channels = await notifications.listChannels(ctxA);
    expect(channels.some((c) => c.id === ch.id)).toBe(true);
  });

  it('dispatch invoice.issued → notification_log SENT y webhook recibido', async () => {
    lastWebhookBody = null;

    // Create channel for this test tenant
    const ch = await notifications.createChannel(ctxA, {
      channelType: 'WEBHOOK',
      config: { url: `http://127.0.0.1:${webhookPort}` },
      events: ['invoice.issued'],
    });

    const fakeDocId = '00000000-0000-0000-0000-000000000001';
    await notifications.dispatch(ctxA, 'invoice.issued', fakeDocId, { documentNumber: 1 });

    // Give async dispatch time to complete
    await new Promise((r) => setTimeout(r, 200));

    expect(lastWebhookBody).not.toBeNull();
    const parsed = JSON.parse(lastWebhookBody!) as { event: string };
    expect(parsed.event).toBe('invoice.issued');

    const { rows } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ status: string; channel_id: string }>(
        `SELECT status, channel_id FROM notification_log WHERE channel_id = $1`,
        [ch.id],
      ),
    );
    expect(rows[0]?.status).toBe('SENT');
  });

  it('dispatch para evento diferente → canal no disparado', async () => {
    lastWebhookBody = null;

    const ch = await notifications.createChannel(ctxA, {
      channelType: 'WEBHOOK',
      config: { url: `http://127.0.0.1:${webhookPort}` },
      events: ['credit_note.created'],  // only this event
    });

    await notifications.dispatch(ctxA, 'invoice.issued', '00000000-0000-0000-0000-000000000002', {});
    await new Promise((r) => setTimeout(r, 100));

    // This channel should NOT appear in logs for invoice.issued
    const { rows } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM notification_log WHERE channel_id = $1`,
        [ch.id],
      ),
    );
    expect(rows.length).toBe(0);
  });

  it('WEBHOOK con secret incluye X-Nuvora-Signature header', async () => {
    lastWebhookBody = null;
    lastWebhookHeaders = {};

    await notifications.createChannel(ctxA, {
      channelType: 'WEBHOOK',
      config: { url: `http://127.0.0.1:${webhookPort}`, secret: 'mysecret' },
      events: ['invoice.issued'],
    });

    await notifications.dispatch(ctxA, 'invoice.issued', '00000000-0000-0000-0000-000000000003', { documentNumber: 2 });
    await new Promise((r) => setTimeout(r, 200));

    expect(lastWebhookHeaders['x-nuvora-signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('notification_log append-only: trigger rechaza UPDATE', async () => {
    await notifications.createChannel(ctxA, {
      channelType: 'WEBHOOK',
      config: { url: `http://127.0.0.1:${webhookPort}` },
      events: ['invoice.issued'],
    });

    await notifications.dispatch(ctxA, 'invoice.issued', '00000000-0000-0000-0000-000000000004', {});
    await new Promise((r) => setTimeout(r, 200));

    const { rows: [log] } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM notification_log LIMIT 1`),
    );

    const client = await pool.connect();
    try {
      await expect(
        client.query(`UPDATE notification_log SET status = 'FAILED' WHERE id = $1`, [log!.id]),
      ).rejects.toThrow(/immutable/);
    } finally {
      client.release();
    }
  });

  it('RLS: tenant B no ve canales de tenant A', async () => {
    const channels = await notifications.listChannels(ctxB);
    expect(channels.length).toBe(0);
  });

  it('deleteChannel desactiva canal (soft delete)', async () => {
    const ch = await notifications.createChannel(ctxA, {
      channelType: 'EMAIL',
      config: { to: ['admin@test.com'] },
      events: ['invoice.issued'],
    });

    await notifications.deleteChannel(ctxA, ch.id);

    const channels = await notifications.listChannels(ctxA);
    expect(channels.some((c) => c.id === ch.id)).toBe(false);
  });
});
