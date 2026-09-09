import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { AnalyticsAggregateWorker } from './analytics-aggregate.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.ANALYTICS_AGGREGATE,
    }),
  ],
  providers: [AnalyticsAggregateWorker],
  exports: [BullModule],
})
export class AnalyticsAggregateModule {}
