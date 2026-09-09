import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queue-definitions';

@Processor(QUEUES.ANOMALY_ESCALATION)
export class AnomalyEscalationWorker extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing anomaly escalation job: ${job.id}`);
    return { escalated: true, anomalyId: job.data.anomalyId };
  }
}
