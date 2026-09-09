import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventsGateway } from '../../websocket/events.gateway';

@Injectable()
export class AnomaliesService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly gateway: EventsGateway,
) {}

  async findAll(query: { type?: string; severity?: string; status?: string }) {
    const where: any = {};
    if (query.type) where.anomalyType = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    return await this.prisma.anomalyAlert.findMany({ where });
  }

  async assignToAdmin(id: string, adminId: string) {
    return await this.prisma.anomalyAlert.update({
      where: { id },
      data: { assignedToId: adminId, status: 'INVESTIGATING' },
    });
  }

  async updateStatus(id: string, status: string) {
    return await this.prisma.anomalyAlert.update({
      where: { id },
      data: { status: status as any },
    });
  }
  async create(createDto: any) {
    const anomaly = await this.prisma.anomalyAlert.create({
      data: createDto,
    });

    this.gateway.emitToAdmins('anomaly:detected', {
      anomalyId: anomaly.id,
      type: (anomaly as any).anomalyType ?? (anomaly as any).type,
      severity: anomaly.severity,
    });

    return anomaly;
}

}


