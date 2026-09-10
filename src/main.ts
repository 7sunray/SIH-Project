import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { SchedulerService } from './workers/scheduler';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Structured JSON logs via pino (pipe stdout to pino-pretty locally).
  app.useLogger(app.get(PinoLogger));

  // HTTPS enforcement in production (TLS terminates at the proxy/LB, which
  // sets X-Forwarded-Proto; direct HTTP hits are redirected).
  if (process.env.NODE_ENV === 'production') {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
    expressApp.use((req: any, res: any, next: any) => {
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
  }

  app.use(helmet());
  // Production locks CORS to the official domain (plus CORS_ORIGIN extras);
  // development reflects the request origin so local frontends keep working.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'https://dosje.gov.in')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
    credentials: true,
  });
  // transform: true is required on top of the guide's options so @Type()
  // coercions (e.g. query ?page=2 -> number) keep working.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Global audit trail: logs POST/PUT/PATCH/DELETE to audit_logs.
  app.useGlobalInterceptors(new AuditInterceptor(app.get(PrismaService)));

  // Retrieve and execute the background job scheduler.
  // SchedulerService is registered in AppModule; if Redis is down we log
  // instead of crashing the whole API boot.
  try {
    const schedulerService = app.get(SchedulerService, { strict: false });
    if (schedulerService) {
      await schedulerService.registerCronJobs();
    } else {
      logger.warn('SchedulerService not found, skipping cron registration');
    }
  } catch (err) {
    logger.error(
      `Failed to register cron jobs, continuing without scheduler: ${(err as Error).message}`,
    );
  }

  // Render/Heroku-style hosts assign the port via PORT env.
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`Listening on port ${port}`);
}
bootstrap();
