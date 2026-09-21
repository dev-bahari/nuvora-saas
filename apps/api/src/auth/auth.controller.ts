import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { OnboardingService } from './onboarding.service.js';

const COOKIE_NAME = 'nuvora_session';
const CSRF_COOKIE = 'nuvora_csrf';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const IS_PROD = process.env['NODE_ENV'] === 'production';

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? '') : undefined;
}

function setSessionCookie(reply: FastifyReply, token: string, csrfToken: string): void {
  const cookieOpts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    IS_PROD ? 'Secure' : '',
  ].filter(Boolean).join('; ');

  const csrfOpts = [
    `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}`,
    `Path=/`,
    `SameSite=Strict`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    IS_PROD ? 'Secure' : '',
  ].filter(Boolean).join('; ');

  void reply.header('Set-Cookie', [cookieOpts, csrfOpts]);
}

function clearSessionCookies(reply: FastifyReply): void {
  void reply.header('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0`,
  ]);
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly onboardingService: OnboardingService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const { sessionToken, csrfToken } = await this.authService.login(
      body.email,
      body.password,
      ip,
      userAgent,
    );
    setSessionCookie(reply, sessionToken, csrfToken);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = parseCookie(req.headers['cookie'], COOKIE_NAME);
    if (rawToken) {
      await this.authService.validateCsrf(rawToken, req.headers['x-csrf-token'] as string ?? '');
      await this.authService.logout(rawToken);
    }
    clearSessionCookies(reply);
    return { ok: true };
  }

  @Get('session')
  @HttpCode(HttpStatus.OK)
  async getSession(@Req() req: FastifyRequest) {
    const rawToken =
      parseCookie(req.headers['cookie'], COOKIE_NAME) ??
      req.headers['authorization']?.replace('Bearer ', '');

    if (!rawToken) {
      throw new UnauthorizedException('No session');
    }

    const session = await this.authService.getSession(rawToken);
    return {
      userId: session.userId,
      tenantId: session.tenantId,
      email: session.email,
      fullName: session.fullName,
      tenantName: session.tenantName,
    };
  }

  @Post('password/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() body: { email: string },
    @Req() req: FastifyRequest,
  ) {
    const rawToken = parseCookie(req.headers['cookie'], COOKIE_NAME);
    if (rawToken) {
      await this.authService.validateCsrf(rawToken, req.headers['x-csrf-token'] as string ?? '');
    }
    await this.authService.requestPasswordReset(body.email);
    return { ok: true }; // always 200 — no enumeration
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { token: string; newPassword: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = parseCookie(req.headers['cookie'], COOKIE_NAME);
    if (rawToken) {
      await this.authService.validateCsrf(rawToken, req.headers['x-csrf-token'] as string ?? '');
    }
    await this.authService.resetPassword(body.token, body.newPassword);
    clearSessionCookies(reply);
    return { ok: true };
  }

  @Post('onboarding')
  @HttpCode(HttpStatus.CREATED)
  async onboard(
    @Body() body: { email: string; password: string; fullName: string; tenantName: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = parseCookie(req.headers['cookie'], COOKIE_NAME);
    if (rawToken) {
      await this.authService.validateCsrf(rawToken, req.headers['x-csrf-token'] as string ?? '');
    }

    const ip = req.ip;
    const result = await this.onboardingService.onboard(
      body.email,
      body.password,
      body.fullName,
      body.tenantName,
      ip,
    );

    // Log in automatically after onboarding
    const userAgent = req.headers['user-agent'];
    const { sessionToken, csrfToken } = await this.authService.login(
      body.email,
      body.password,
      ip,
      userAgent,
    );
    setSessionCookie(reply, sessionToken, csrfToken);

    return { ok: true, userId: result.userId, tenantId: result.tenantId };
  }
}
