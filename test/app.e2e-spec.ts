import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AuditInterceptor } from '../src/common/interceptors/audit.interceptor';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const loginBody = {
    email: 'e2e@dosje.local',
    password: 'secret123',
    deviceFingerprint: 'e2e-suite',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    // Mirror main.ts globals (bootstrap is not executed under jest).
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    prisma = app.get(PrismaService);
    app.useGlobalInterceptors(new AuditInterceptor(prisma));
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200);
  });

  it('/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send(loginBody)
      .expect(201)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
      });
  });

  it('/auth/login rejects invalid input', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'short', deviceFingerprint: 'x' })
      .expect(400);
  });

  it('/auth/login rejects unknown properties', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...loginBody, admin: true })
      .expect(400);
  });

  it('/auth/refresh (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'e2e-refresh' })
      .expect(201)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
      });
  });

  it('/auth/logout rejects unauthenticated requests', () => {
    return request(app.getHttpServer()).post('/auth/logout').expect(401);
  });

  it('/auth/logout (POST) with a token', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send(loginBody);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual({ success: true });
      });
  });

  it('writes a redacted audit row for login', async () => {
    await request(app.getHttpServer()).post('/auth/login').send(loginBody).expect(201);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'POST auth' },
      orderBy: { createdAt: 'desc' },
    });

    expect(row).toBeDefined();
    expect((row?.afterJson as any)?.accessToken).toBe('[REDACTED]');
    expect((row?.afterJson as any)?.refreshToken).toBe('[REDACTED]');
  });
});
