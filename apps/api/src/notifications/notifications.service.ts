import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { Injectable, Logger, Optional } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

export type NotificationEvent =
  | 'invoice.issued'
  | 'invoice.rejected'
  | 'credit_note.created'
  | 'debit_note.created';

export interface NotificationChannel {
  id: string;
  channelType: 'EMAIL' | 'WEBHOOK' | 'WHATSAPP';
  config: Record<string, unknown>;
  events: string[];
}

type DbChannel = {
  id: string;
  channel_type: 'EMAIL' | 'WEBHOOK' | 'WHATSAPP';
  config: Record<string, unknown>;
  events: string[];
};

/**
 * NotificationsService — fan-out notifications on document events.
 *
 * Email: calls SMTP relay via HTTP (uses SMTP_RELAY_URL env or no-op).
 * Webhook: POST JSON with HMAC-SHA256 signature header.
 * WhatsApp: Meta Cloud API template message (WHATSAPP_TOKEN env).
 *
 * ponytail: no retry queue; add pg-boss job on FAILED rows when reliability matters.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Optional() private readonly customPool?: pg.Pool) {}

  private pool(): pg.Pool {
    return this.customPool ?? new pg.Pool();
  }

  async dispatch(
    ctx: RequestContext,
    event: NotificationEvent,
    documentId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const channels = await withTenant(this.pool(), ctx, (tx) =>
      tx.query<DbChannel>(
        `SELECT id, channel_type, config, events FROM notification_channels
         WHERE is_active = TRUE AND $1 = ANY(events)`,
        [event],
      ).then((r) => r.rows),
    );

    await Promise.allSettled(
      channels.map((ch) => this.send(ctx, ch, event, documentId, payload)),
    );
  }

  private async send(
    ctx: RequestContext,
    channel: DbChannel,
    event: string,
    documentId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined;

    try {
      if (channel.channel_type === 'EMAIL') {
        await this.sendEmail(channel.config, event, payload);
      } else if (channel.channel_type === 'WEBHOOK') {
        await this.sendWebhook(channel.config, event, payload);
      } else {
        await this.sendWhatsApp(channel.config, event, payload);
      }
    } catch (err) {
      status = 'FAILED';
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notification failed [${channel.channel_type}] event=${event}: ${errorMessage}`);
    }

    // Log result — append-only table
    await withTenant(this.pool(), ctx, (tx) =>
      tx.query(
        `INSERT INTO notification_log (tenant_id, channel_id, document_id, event_type, channel_type, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ctx.tenantId, channel.id, documentId, event, channel.channel_type, status, errorMessage ?? null],
      ),
    );
  }

  private async sendEmail(
    config: Record<string, unknown>,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const relayUrl = process.env['SMTP_RELAY_URL'];
    if (!relayUrl) {
      // ponytail: no-op in dev; wire nodemailer or SMTP relay in production
      this.logger.debug(`[EMAIL no-op] event=${event} to=${JSON.stringify(config['to'])}`);
      return;
    }

    const body = JSON.stringify({ to: config['to'], subject: `Nuvora: ${event}`, event, payload });
    await httpPost(relayUrl, body, {});
  }

  private async sendWebhook(
    config: Record<string, unknown>,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const url = config['url'] as string;
    const secret = config['secret'] as string | undefined;
    const body = JSON.stringify({ event, payload, timestamp: Date.now() });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Nuvora-Signature'] = `sha256=${sig}`;
    }

    await httpPost(url, body, headers);
  }

  private async sendWhatsApp(
    config: Record<string, unknown>,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const token = process.env['WHATSAPP_TOKEN'] ?? (config['token'] as string | undefined);
    const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? (config['phoneNumberId'] as string | undefined);
    const to = config['phone'] as string;

    if (!token || !phoneNumberId) {
      this.logger.debug(`[WHATSAPP no-op] event=${event} to=${to} — token/phoneNumberId not configured`);
      return;
    }

    const templateName = eventToTemplate(event);
    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es_CO' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: String(payload['documentNumber'] ?? '') }] }],
      },
    });

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    await httpPost(url, body, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  // ── Channel CRUD ────────────────────────────────────────────────────────────

  async createChannel(
    ctx: RequestContext,
    dto: { channelType: 'EMAIL' | 'WEBHOOK' | 'WHATSAPP'; config: Record<string, unknown>; events: string[] },
  ): Promise<NotificationChannel> {
    const { rows: [ch] } = await withTenant(this.pool(), ctx, (tx) =>
      tx.query<DbChannel>(
        `INSERT INTO notification_channels (tenant_id, channel_type, config, events)
         VALUES ($1, $2, $3, $4)
         RETURNING id, channel_type, config, events`,
        [ctx.tenantId, dto.channelType, JSON.stringify(dto.config), dto.events],
      ),
    );
    return mapChannel(ch!);
  }

  async listChannels(ctx: RequestContext): Promise<NotificationChannel[]> {
    const { rows } = await withTenant(this.pool(), ctx, (tx) =>
      tx.query<DbChannel>(
        `SELECT id, channel_type, config, events FROM notification_channels WHERE is_active = TRUE ORDER BY created_at`,
      ),
    );
    return rows.map(mapChannel);
  }

  async deleteChannel(ctx: RequestContext, channelId: string): Promise<void> {
    await withTenant(this.pool(), ctx, (tx) =>
      tx.query(
        `UPDATE notification_channels SET is_active = FALSE WHERE id = $1`,
        [channelId],
      ),
    );
  }
}

function mapChannel(r: DbChannel): NotificationChannel {
  return { id: r.id, channelType: r.channel_type, config: r.config, events: r.events };
}

function eventToTemplate(event: string): string {
  const map: Record<string, string> = {
    'invoice.issued': 'nuvora_invoice_issued',
    'invoice.rejected': 'nuvora_invoice_rejected',
    'credit_note.created': 'nuvora_credit_note',
    'debit_note.created': 'nuvora_debit_note',
  };
  return map[event] ?? 'nuvora_generic';
}

function httpPost(url: string, body: string, headers: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, port: parsed.port || undefined, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          resolve();
        }
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
