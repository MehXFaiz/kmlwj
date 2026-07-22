import type { VercelRequest, VercelResponse } from '@vercel/node';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days, matches REFRESH_TOKEN_EXPIRY_DAYS

// Manual cookie parsing/serialization — works identically whether the request
// arrives through the Express dev server or a Vercel serverless function,
// without depending on framework-specific cookie auto-parsing or an extra
// npm dependency.

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getRefreshTokenCookie(req: VercelRequest): string | undefined {
  const existing = (req as any).cookies?.[REFRESH_COOKIE_NAME];
  if (existing) return existing;
  return parseCookieHeader(req.headers?.cookie as string | undefined)[REFRESH_COOKIE_NAME];
}

function appendSetCookie(res: VercelResponse, cookie: string) {
  const prior = res.getHeader('Set-Cookie');
  if (!prior) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(prior)) {
    res.setHeader('Set-Cookie', [...prior, cookie]);
  } else {
    res.setHeader('Set-Cookie', [prior as string, cookie]);
  }
}

export function setRefreshTokenCookie(res: VercelResponse, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const attrs = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api/auth',
    `Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) attrs.push('Secure');
  appendSetCookie(res, attrs.join('; '));
}

export function clearRefreshTokenCookie(res: VercelResponse) {
  const isProd = process.env.NODE_ENV === 'production';
  const attrs = [
    `${REFRESH_COOKIE_NAME}=`,
    'Path=/api/auth',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) attrs.push('Secure');
  appendSetCookie(res, attrs.join('; '));
}
