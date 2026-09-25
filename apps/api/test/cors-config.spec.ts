import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { isAllowedOrigin } from '../src/http/cors-config.js';
import { configureCors } from '../src/http/cors-config.js';

describe('isAllowedOrigin', () => {
  it('allows the configured production web origin', () => {
    expect(isAllowedOrigin('https://empyra-web-production.up.railway.app')).toBe(true);
  });

  it('rejects an unrelated origin', () => {
    expect(isAllowedOrigin('https://untrusted.example')).toBe(false);
  });

  it('answers an allowed credentialed preflight request', async () => {
    const app = Fastify();
    configureCors(app);

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/settings/dian/credentials',
      headers: { origin: 'https://empyra-web-production.up.railway.app' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://empyra-web-production.up.railway.app');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
