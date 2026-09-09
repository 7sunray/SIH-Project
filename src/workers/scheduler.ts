import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '../queues/queue-definitions';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUES.CCTV_HEALTH) private cctvQueue: Queue,
    @InjectQueue(QUEUES.ANALYTICS_AGGREGATE) private analyticsQueue: Queue,
  ) {}

  async registerCronJobs() {
    this.logger.log('Registering background cron jobs...');

    // Schedule CCTV Health Check to run every 5 minutes
    await this.cctvQueue.add(
      'health-ping',
      {},
      {
        jobId: 'cron-cctv-health',
        repeat: {
          pattern: '*/5 * * * *',
        },
      } as Record<string, any>,
    );

    // Schedule Analytics Aggregation to run daily at midnight
    await this.analyticsQueue.add(
      'daily-aggregate',
      {},
      {
        jobId: 'cron-analytics-aggregate',
        repeat: {
          pattern: '0 0 * * *',
        },
      } as Record<string, any>,
    );

    this.logger.log('Cron jobs successfully registered.');
  }
}
