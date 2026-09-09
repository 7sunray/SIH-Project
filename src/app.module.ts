import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { MediaModule } from './modules/media/media.module';
import { AnomaliesModule } from './modules/anomalies/anomalies.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CctvModule } from './modules/cctv/cctv.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthModule } from './modules/health/health.module';
import { AnomalyProcessModule } from './workers/anomaly-process.module';
import { SchedulerService } from './workers/scheduler';
import { QUEUES } from './queues/queue-definitions';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ??
          (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        autoLogging: {
          ignore: (req) => req.url === '/metrics' || req.url === '/health',
        },
      },
    }),
    PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: true } }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
        // ThrottlerGuard only understands HTTP contexts; skip everything
        // else so the socket.io gateway keeps working.
        skipIf: (context) => context.getType() !== 'http',
      },
    ]),
    BullModule.registerQueue(
      { name: QUEUES.CCTV_HEALTH },
      { name: QUEUES.ANALYTICS_AGGREGATE },
    ),
    CommonModule,
    UsersModule,
    AuthModule,
    InspectionsModule,
    MediaModule,
    AnomaliesModule,
    AnalyticsModule,
    CctvModule,
    HealthModule,
    WebsocketModule,
    AnomalyProcessModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SchedulerService,
    // Enforces the throttler config above on every HTTP route.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

