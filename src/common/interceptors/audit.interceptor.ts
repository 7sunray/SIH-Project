import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'totpsecret',
  'accesstoken',
  'refreshtoken',
  'token',
  'privatekey',
  'clientsecret',
]);

// Controller-derived entity name -> Prisma delegate candidates (first hit wins).
const ENTITY_DELEGATES: Record<string, string[]> = {
  users: ['user'],
  inspections: ['inspection'],
  anomalies: ['anomalyAlert', 'anomaly'],
  cctv: ['cctvFeed', 'cCTVFeed'],
  projects: ['project'],
  institutes: ['instituteNgo'],
  media: ['reportMedia'],
  notifications: ['notification'],
};

/**
 * Captures before/after state for every POST/PUT/PATCH/DELETE and writes a
 * row to audit_logs (userId, action, entity, entityId, beforeJson, afterJson,
 * ip, userAgent). Best-effort by design: audit failures are logged and never
 * break the request. Secrets/tokens are redacted before persisting.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    if (!MUTATING_METHODS.has(req?.method)) {
      return next.handle();
    }

    const entity =
      context.getClass().name.replace(/Controller$/, '').toLowerCase() || 'unknown';
    const paramId = AuditInterceptor.uuidOrNull(req.params?.id);

    // Snapshot current state BEFORE the handler mutates it.
    let beforeJson: Record<string, unknown> | null = null;
    if ((req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && paramId) {
      beforeJson = await this.loadBefore(entity, paramId);
    }

    return next.handle().pipe(
      tap({
        next: (body) => {
          void this.persist(req, entity, paramId, beforeJson, body, null);
        },
        error: (err: unknown) => {
          void this.persist(req, entity, paramId, beforeJson, null, err);
        },
      }),
    );
  }

  private async persist(
    req: any,
    entity: string,
    paramId: string | null,
    beforeJson: Record<string, unknown> | null,
    body: unknown,
    error: unknown,
  ): Promise<void> {
    try {
      const userId = AuditInterceptor.uuidOrNull(
        req.user?.userId ?? req.user?.sub ?? req.user?.id,
      );
      const bodyId = AuditInterceptor.uuidOrNull(
        body && typeof body === 'object' ? (body as Record<string, unknown>).id : undefined,
      );
      await (this.prisma as any).auditLog.create({
        data: {
          userId,
          action: `${req.method} ${entity}${paramId ? '/:id' : ''}`.slice(0, 100),
          entity: String(entity).slice(0, 100),
          entityId: paramId ?? bodyId,
          beforeJson,
          afterJson:
            error !== null && error !== undefined
              ? { error: (error as Error)?.message ?? String(error) }
              : AuditInterceptor.toJson(body),
          ipAddress:
            typeof req.ip === 'string' ? req.ip.slice(0, 45) : undefined,
          userAgent:
            typeof req.headers?.['user-agent'] === 'string'
              ? req.headers['user-agent'].slice(0, 512)
              : undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`audit write failed: ${(err as Error).message}`);
    }
  }

  private async loadBefore(
    entity: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    for (const delegate of ENTITY_DELEGATES[entity] ?? []) {
      try {
        const finder = (this.prisma as any)[delegate]?.findUnique;
        if (typeof finder !== 'function') continue;
        const record = await finder.call((this.prisma as any)[delegate], { where: { id } });
        if (record) return AuditInterceptor.toJson(record);
      } catch {
        // Best-effort: missing table/delegate must not break the request.
      }
    }
    return null;
  }

  private static uuidOrNull(value: unknown): string | null {
    return typeof value === 'string' && UUID_RE.test(value) ? value : null;
  }

  /** Plain-JSON clone with secrets redacted and BigInts stringified. */
  private static toJson(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) return null;
    try {
      const text = JSON.stringify(value, (key, entry) => {
        if (typeof key === 'string' && SENSITIVE_KEYS.has(key.toLowerCase())) {
          return '[REDACTED]';
        }
        return typeof entry === 'bigint' ? entry.toString() : entry;
      });
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : { value: parsed };
    } catch {
      return { value: String(value).slice(0, 2000) };
    }
  }
}
