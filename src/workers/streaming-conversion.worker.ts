import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queue-definitions';

@Processor(QUEUES.STREAMING_CONVERSION)
export class StreamingConversionWorker extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing streaming conversion job: ${job.id}`);
    // Add video stream or media transcoding logic here
    return { converted: true, fileId: job.data.fileId };
  }
}
