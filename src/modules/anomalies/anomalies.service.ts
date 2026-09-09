import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnomaliesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { type?: string; severity?: string; status?: string }) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    return await (this.prisma as any).anomaly.findMany({ where });
  }

  async assignToAdmin(id: string, adminId: string) {
    return await (this.prisma as any).anomaly.update({
      where: { id },
      data: { assignedAdminId: adminId, status: 'INVESTIGATING' },
    });
  }

  async updateStatus(id: string, status: string) {
    return await (this.prisma as any).anomaly.update({
      where: { id },
      data: { status },
    });
  }
}

