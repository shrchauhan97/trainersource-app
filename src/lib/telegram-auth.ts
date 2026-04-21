import crypto from 'node:crypto';

/** Payload shape from the Telegram Login Widget (per official spec). */
export interface LoginWidgetPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Verified user, hash stripped. */
export interface VerifiedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
}

const MAX_AUTH_AGE_SECONDS = 86_400;

/**
 * Verify a Telegram Login Widget callback.
 * See https://core.telegram.org/widgets/login#checking-authorization
 *
 * Returns the verified user object (hash stripped) on success, or null if the
 * payload fails HMAC verification or is older than 24h.
 */
export function verifyLoginWidget(
  payload: Partial<LoginWidgetPayload>,
  botToken: string,
): VerifiedTelegramUser | null {
  if (!payload || typeof payload.hash !== 'string' || !payload.hash) return null;
  if (typeof payload.id !== 'number') return null;
  if (typeof payload.auth_date !== 'number') return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - payload.auth_date > MAX_AUTH_AGE_SECONDS) return null;

  const { hash, ...rest } = payload as LoginWidgetPayload;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${(rest as Record<string, unknown>)[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const a = Buffer.from(expected.toLowerCase(), 'utf8');
  const b = Buffer.from(hash.toLowerCase(), 'utf8');
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return {
    id: payload.id,
    first_name: payload.first_name!,
    last_name: payload.last_name,
    username: payload.username,
    photo_url: payload.photo_url,
    auth_date: payload.auth_date,
  };
}
