import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { AnomalyEscalationWorker } from './anomaly-escalation.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.ANOMALY_ESCALATION,
    }),
  ],
  providers: [AnomalyEscalationWorker],
  exports: [BullModule],
})
export class AnomalyEscalationModule {}