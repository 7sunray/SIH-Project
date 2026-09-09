import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { AnomalyProcessWorker } from './anomaly-process.worker';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.ANOMALY_PROCESS }), WebsocketModule],
  providers: [AnomalyProcessWorker],
  exports: [BullModule],
})
export class AnomalyProcessModule {}
