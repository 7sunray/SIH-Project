import { ConfigService } from '@nestjs/config';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, unknown>;
}

/**
 * Builds the BullMQ/ioredis connection options.
 *
 * Default: REDIS_HOST/REDIS_PORT (plain TCP, local dev + docker compose).
 * Managed providers (e.g. Upstash free tier) give a single URL instead:
 * set REDIS_URL=rediss://default:<password>@<host>:<port> and it takes
 * precedence, enabling TLS automatically for the rediss:// scheme.
 */
export function buildRedisConnection(config: ConfigService): RedisConnectionOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(
        'Invalid REDIS_URL. Expected redis://host:port or rediss://user:password@host:port',
      );
    }
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  }
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: Number(config.get('REDIS_PORT', 6380)),
  };
}
