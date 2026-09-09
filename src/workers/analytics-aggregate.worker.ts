import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queue-definitions';

@Processor(QUEUES.ANALYTICS_AGGREGATE)
export class AnalyticsAggregateWorker extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing analytics aggregation job: ${job.id}`);
    return { aggregated: true };
  }
}
