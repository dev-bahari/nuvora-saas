import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { Injectable } from '@nestjs/common';
import type { PutArtifactInput, StorageProvider, StoredArtifact } from './storage.provider.js';

const ENDPOINT = process.env['STORAGE_ENDPOINT'] ?? 'http://localhost:9000';
const BUCKET = process.env['STORAGE_BUCKET'] ?? 'nuvora-artifacts';
const ACCESS_KEY = process.env['STORAGE_ACCESS_KEY'] ?? 'minioadmin';
const SECRET_KEY = process.env['STORAGE_SECRET_KEY'] ?? 'minioadmin';
const REGION = process.env['STORAGE_REGION'] ?? 'us-east-1';

// ─── Minimal SigV4 presigner for S3/MinIO ──────────────────────────────────

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function signingKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function presignedPutUrl(
  endpoint: string,
  bucket: string,
  key: string,
  contentType: string,
  expiresSeconds: number,
): string {
  const url = new URL(`/${bucket}/${key}`, endpoint);
  const now = new Date();
  const dateTime = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const date = dateTime.slice(0, 8);
  const host = url.host;
  const scope = `${date}/${REGION}/s3/aws4_request`;

  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${ACCESS_KEY}/${scope}`);
  url.searchParams.set('X-Amz-Date', dateTime);
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  url.searchParams.set('X-Amz-SignedHeaders', 'host');
  url.searchParams.set('X-Amz-ContentSHA256', 'UNSIGNED-PAYLOAD');

  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    url.searchParams.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const sig = hmac(signingKey(SECRET_KEY, date, REGION, 's3'), stringToSign).toString('hex');
  url.searchParams.set('X-Amz-Signature', sig);

  return url.toString();
}

function presignedGetUrl(
  endpoint: string,
  bucket: string,
  key: string,
  expiresSeconds: number,
): string {
  const url = new URL(`/${bucket}/${key}`, endpoint);
  const now = new Date();
  const dateTime = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const date = dateTime.slice(0, 8);
  const host = url.host;
  const scope = `${date}/${REGION}/s3/aws4_request`;

  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${ACCESS_KEY}/${scope}`);
  url.searchParams.set('X-Amz-Date', dateTime);
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  url.searchParams.set('X-Amz-SignedHeaders', 'host');

  const canonicalRequest = [
    'GET',
    `/${bucket}/${key}`,
    url.searchParams.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const sig = hmac(signingKey(SECRET_KEY, date, REGION, 's3'), stringToSign).toString('hex');
  url.searchParams.set('X-Amz-Signature', sig);

  return url.toString();
}

// ─── Adapter ───────────────────────────────────────────────────────────────

@Injectable()
export class MinioStorageAdapter implements StorageProvider {
  async putPrivate(input: PutArtifactInput): Promise<StoredArtifact> {
    const sha256 = crypto.createHash('sha256').update(input.body).digest('hex');

    await httpPut(
      `${ENDPOINT}/${BUCKET}/${input.key}`,
      input.body,
      input.contentType,
      ACCESS_KEY,
      SECRET_KEY,
    );

    return { key: input.key, sha256, sizeBytes: input.body.length };
  }

  async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return presignedGetUrl(ENDPOINT, BUCKET, key, expiresInSeconds);
  }
}

function httpPut(
  url: string,
  body: Buffer,
  contentType: string,
  accessKey: string,
  secretKey: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const now = new Date();
    const dateTime = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
    const date = dateTime.slice(0, 8);
    const host = parsed.host;
    const path = parsed.pathname;
    const scope = `${date}/${REGION}/s3/aws4_request`;
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${dateTime}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;
    const stringToSign = `AWS4-HMAC-SHA256\n${dateTime}\n${scope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const sig = hmac(signingKey(secretKey, date, REGION, 's3'), stringToSign).toString('hex');
    const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      { method: 'PUT', host: parsed.hostname, port: parsed.port, path: parsed.pathname, headers: {
        'Content-Type': contentType,
        'Content-Length': body.length,
        'X-Amz-Date': dateTime,
        'X-Amz-Content-SHA256': bodyHash,
        Authorization: auth,
      }},
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`MinIO PUT failed: ${res.statusCode}`));
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

// ─── In-memory adapter for tests without MinIO running ─────────────────────
// ponytail: InMemoryStorageAdapter for integration tests; swap for MinioStorageAdapter in compose tests

export class InMemoryStorageAdapter implements StorageProvider {
  private store = new Map<string, Buffer>();

  async putPrivate(input: PutArtifactInput): Promise<StoredArtifact> {
    this.store.set(input.key, input.body);
    const sha256 = crypto.createHash('sha256').update(input.body).digest('hex');
    return { key: input.key, sha256, sizeBytes: input.body.length };
  }

  async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expires = Date.now() + expiresInSeconds * 1000;
    return `http://localhost/download/${key}?expires=${expires}`;
  }
}

void presignedPutUrl; // kept for future use
