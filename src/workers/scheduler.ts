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

  /**
   * Idempotent scheduler sync: upserting by stable id updates the template
   * in place, and same-name leftovers from older schedule shapes are removed.
   */
  private async syncScheduler(
    queue: Queue,
    id: string,
    repeat: { every?: number; pattern?: string },
    jobName: string,
  ) {
    try {
      const schedulers = await queue.getJobSchedulers();
      for (const scheduler of schedulers) {
        if (scheduler.name === jobName && scheduler.id !== id && scheduler.id) {
          await queue.removeJobScheduler(scheduler.id);
        }
      }
    } catch (err) {
      this.logger.warn(`scheduler cleanup skipped: ${(err as Error).message}`);
    }
    await queue.upsertJobScheduler(id, repeat, { name: jobName, data: {} });
  }

  async registerCronJobs() {
    this.logger.log('Registering background cron jobs...');

    // CCTV health ping every 30s (per-ops checklist).
    await this.syncScheduler(this.cctvQueue, 'cron-cctv-health', { every: 30_000 }, 'health-ping');

    // Schedule Analytics Aggregation to run daily at midnight
    await this.syncScheduler(
      this.analyticsQueue,
      'cron-analytics-aggregate',
      { pattern: '0 0 * * *' },
      'daily-aggregate',
    );

    this.logger.log('Cron jobs successfully registered.');
  }
}
