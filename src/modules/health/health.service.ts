import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService, PrismaHealthIndicator } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthIndicatorService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  database() {
    return this.prismaIndicator.pingCheck('database', this.prisma).withTimeout(1500);
  }

  redis() {
    const host = this.config.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.config.get('REDIS_PORT', 6380));
    return this.health
      .check('redis')
      .attempt(async () => {
        const client = new Redis({
          host,
          port,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
        try {
          await client.ping();
          return { host, port };
        } finally {
          client.disconnect();
        }
      })
      .withTimeout(2000);
  }

  storage() {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    return this.health
      .check('s3')
      .attempt(async ({ signal }) => {
        // Unauthenticated MinIO answers 403 when alive; only 5xx/network
        // failures mean down.
        const res = await fetch(endpoint, { signal });
        if (res.status >= 500) {
          throw new Error(`S3 status ${res.status}`);
        }
        return { endpoint, statusCode: res.status };
      })
      .withTimeout(3000);
  }
}
