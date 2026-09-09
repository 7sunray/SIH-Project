import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardOverview() {
    const totalInspections = await (this.prisma as any).inspection.count();
    const totalAnomalies = await (this.prisma as any).anomalyAlert.count();
    
    return {
      totalInspections,
      totalAnomalies,
      activeTimestamp: new Date(),
    };
  }

  async getAnomalyAggregations() {
    return await (this.prisma as any).anomalyAlert.groupBy({
      by: ['status', 'severity'],
      _count: { id: true },
    });
  }

  async getInspectionStatistics() {
    return await (this.prisma as any).inspection.groupBy({
      by: ['status'],
      _count: { id: true },
    });
  }
}
