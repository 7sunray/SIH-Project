import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { CctvHealthWorker } from './cctv-health.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.CCTV_HEALTH,
    }),
  ],
  providers: [CctvHealthWorker],
  exports: [BullModule],
})
export class CctvHealthModule {}
