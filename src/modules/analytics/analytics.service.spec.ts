import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const inspection = { count: jest.fn(), groupBy: jest.fn() };
  const anomalyAlert = { count: jest.fn(), groupBy: jest.fn() };
  const prismaMock: any = { inspection, anomalyAlert };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should return the dashboard overview', async () => {
    inspection.count.mockResolvedValue(10);
    anomalyAlert.count.mockResolvedValue(3);

    const result = await service.getDashboardOverview();

    expect(result.totalInspections).toBe(10);
    expect(result.totalAnomalies).toBe(3);
    expect(result.activeTimestamp).toBeInstanceOf(Date);
  });

  it('should aggregate anomalies by status and severity', async () => {
    anomalyAlert.groupBy.mockResolvedValue([{ status: 'DETECTED', _count: { id: 2 } }]);

    const result = await service.getAnomalyAggregations();

    expect(anomalyAlert.groupBy).toHaveBeenCalledWith({
      by: ['status', 'severity'],
      _count: { id: true },
    });
    expect(result).toEqual([{ status: 'DETECTED', _count: { id: 2 } }]);
  });

  it('should aggregate inspections by status', async () => {
    inspection.groupBy.mockResolvedValue([{ status: 'SCHEDULED', _count: { id: 5 } }]);

    await service.getInspectionStatistics();

    expect(inspection.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { id: true },
    });
  });
});
