import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queue-definitions';

@Processor(QUEUES.CCTV_HEALTH)
export class CctvHealthWorker extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing CCTV health check job: ${job.id}`);
    // Add health ping implementation logic here
    return { status: 'healthy', timestamp: new Date() };
  }
}

