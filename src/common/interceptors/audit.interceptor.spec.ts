import { CallHandler } from '@nestjs/common';
import { lastValueFrom, Observable, of, throwError } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AuditInterceptor } from './audit.interceptor';

function handlerFor(observable: Observable<unknown>): CallHandler {
  return { handle: () => observable } as CallHandler;
}

const USER_ID = '2fe45eed-c6fd-4dac-a7ca-a7a72cbd823e';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  const auditLog = { create: jest.fn() };
  const prismaMock: any = {
    auditLog,
    user: { findUnique: jest.fn() },
  };

  function buildContext(method: string, options: any = {}) {
    const req = {
      method,
      params: options.params ?? {},
      user: options.user,
      url: options.url ?? '/',
      ip: '1.2.3.4',
      headers: { 'user-agent': 'jest' },
    };
    const context: any = {
      switchToHttp: () => ({ getRequest: () => req }),
      getClass: () => ({ name: `${options.controller ?? 'Users'}Controller` }),
      getHandler: () => jest.fn(),
    };
    return { req, context };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    auditLog.create.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
  });

  it('should audit mutating requests with redacted secrets', async () => {
    const { context } = buildContext('POST', { user: { userId: USER_ID } });

    const response = await lastValueFrom(
      await interceptor.intercept(context, handlerFor(of({ id: 'x', password: 'pw' }))),
    );

    expect(response).toEqual({ id: 'x', password: 'pw' });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        action: 'POST users',
        entity: 'users',
      }),
    });
    const logged = auditLog.create.mock.calls[0][0].data.afterJson;
    expect(logged.password).toBe('[REDACTED]');
  });

  it('should skip safe methods', async () => {
    const { context } = buildContext('GET');

    await lastValueFrom(await interceptor.intercept(context, handlerFor(of([]))));

    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('should capture before-state on updates', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, name: 'Before' });
    const { context } = buildContext('PATCH', {
      params: { id: USER_ID },
      user: { userId: USER_ID },
    });

    await lastValueFrom(
      await interceptor.intercept(context, handlerFor(of({ id: USER_ID }))),
    );

    const logged = auditLog.create.mock.calls[0][0].data;
    expect(logged.action).toBe('PATCH users/:id');
    expect(logged.entityId).toBe(USER_ID);
    expect(logged.beforeJson).toEqual({ id: USER_ID, name: 'Before' });
  });

  it('should log failures without breaking the request', async () => {
    auditLog.create.mockRejectedValueOnce(new Error('db down'));
    const { context } = buildContext('POST');

    const response = await lastValueFrom(
      await interceptor.intercept(context, handlerFor(of({ ok: true }))),
    );

    expect(response).toEqual({ ok: true });
  });

  it('should record handler errors in afterJson', async () => {
    const { context } = buildContext('DELETE', { params: { id: USER_ID } });

    await expect(
      lastValueFrom(
        await interceptor.intercept(
          context,
          handlerFor(throwError(() => new Error('boom'))),
        ),
      ),
    ).rejects.toThrow('boom');
    expect(auditLog.create.mock.calls[0][0].data.afterJson).toEqual({ error: 'boom' });
  });
});
