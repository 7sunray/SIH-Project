import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { buildRedisConnection } from '../queues/redis-connection';
import { CctvHealthModule } from './cctv-health.module';
import { AnomalyEscalationModule } from './anomaly-escalation.module';
// NOTE: filename has a historical typo (aggregrate); keep import in sync.
import { AnalyticsAggregateModule } from './analytics-aggregrate.module';
import { StreamingConversionModule } from './streaming-conversion.module';

/**
 * Dedicated worker context (entrypoint: worker-main.ts).
 * Runs the standalone queue processors. ANOMALY_PROCESS intentionally lives
 * in the API process (AnomalyProcessModule) because it emits via EventsGateway.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisConnection(config),
      }),
    }),
    CctvHealthModule,
    AnomalyEscalationModule,
    AnalyticsAggregateModule,
    StreamingConversionModule,
  ],
})
export class WorkerModule {}
