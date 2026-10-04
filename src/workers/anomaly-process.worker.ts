import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUES } from '../queues/queue-definitions';
import { EventsGateway } from '../websocket/events.gateway';
import { PrismaService } from '../database/prisma.service';

@Processor(QUEUES.ANOMALY_PROCESS)
export class AnomalyProcessWorker extends WorkerHost {
  private readonly logger = new Logger(AnomalyProcessWorker.name);

  constructor(
    private readonly gateway: EventsGateway,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing anomaly detection job: ${job.id}`);

    const { anomalyId, type, severity } = job.data ?? {};
    let payload = { anomalyId, type, severity };

    // Best-effort: enrich the broadcast with the stored record when possible.
    if (anomalyId) {
      try {
        const record =
          (await (this.prisma as any).anomalyAlert?.findUnique?.({ where: { id: anomalyId } })) ??
          (await (this.prisma as any).anomaly?.findUnique?.({ where: { id: anomalyId } }));
        if (record) {
          payload = {
            anomalyId: record.id ?? anomalyId,
            type: record.anomalyType ?? record.type ?? type,
            severity: record.severity ?? severity,
          };
        }
      } catch (err) {
        this.logger.warn(`Anomaly lookup failed for ${anomalyId}: ${(err as Error).message}`);
      }
    }

    this.gateway.emitToAdmins('anomaly:detected', payload);

    return { processed: true, ...payload };
  }
}
