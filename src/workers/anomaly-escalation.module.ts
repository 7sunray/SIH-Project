import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { AnomalyProcessModule}from './anomaly-escalation.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.ANOMALY_ESCALATION,
    }),
  ],
  providers: [AnomalyProcessModule],
  exports: [BullModule],
})
export class AnomalyEscalationModule {}