import { ConfigService } from '@nestjs/config';
import { buildRedisConnection } from './redis-connection';

function configWith(values: Record<string, string | undefined>) {
  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('buildRedisConnection', () => {
  it('should use host/port by default', () => {
    const conn = buildRedisConnection(
      configWith({ REDIS_HOST: 'localhost', REDIS_PORT: '6380' }),
    );

    expect(conn).toEqual({ host: 'localhost', port: 6380 });
  });

  it('should parse a rediss:// URL with TLS', () => {
    const conn = buildRedisConnection(
      configWith({ REDIS_URL: 'rediss://default:s3cret@redis.example.com:6380' }),
    );

    expect(conn).toEqual({
      host: 'redis.example.com',
      port: 6380,
      username: 'default',
      password: 's3cret',
      tls: {},
    });
  });

  it('should parse a plain redis:// URL without TLS', () => {
    const conn = buildRedisConnection(configWith({ REDIS_URL: 'redis://cache:6379' }));

    expect(conn.host).toBe('cache');
    expect(conn.port).toBe(6379);
    expect(conn.tls).toBeUndefined();
  });

  it('should reject a malformed URL', () => {
    expect(() => buildRedisConnection(configWith({ REDIS_URL: '::not-a-url' }))).toThrow(
      /REDIS_URL/,
    );
  });
});
