import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { StreamingConversionWorker } from './streaming-conversion.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.STREAMING_CONVERSION,
    }),
  ],
  providers: [StreamingConversionWorker],
  exports: [BullModule],
})
export class StreamingConversionModule {}
