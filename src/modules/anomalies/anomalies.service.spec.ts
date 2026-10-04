import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { EventsGateway } from '../../websocket/events.gateway';
import { AnomaliesService } from './anomalies.service';

describe('AnomaliesService', () => {
  let service: AnomaliesService;

  const anomalyAlert = { findMany: jest.fn(), update: jest.fn(), create: jest.fn() };
  const prismaMock: any = { anomalyAlert };
  const gatewayMock = { emitToAdmins: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomaliesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventsGateway, useValue: gatewayMock },
      ],
    }).compile();

    service = module.get<AnomaliesService>(AnomaliesService);
  });

  it('should filter anomalies', async () => {
    anomalyAlert.findMany.mockResolvedValue([{ id: 'a-1' }]);

    const result = await service.findAll({ severity: 'HIGH' });

    expect(anomalyAlert.findMany).toHaveBeenCalledWith({ where: { severity: 'HIGH' } });
    expect(result).toEqual([{ id: 'a-1' }]);
  });

  it('should map the public type filter to anomalyType', async () => {
    anomalyAlert.findMany.mockResolvedValue([]);

    await service.findAll({ type: 'CCTV_FEED_INTERRUPTED' });

    expect(anomalyAlert.findMany).toHaveBeenCalledWith({
      where: { anomalyType: 'CCTV_FEED_INTERRUPTED' },
    });
  });

  it('should assign an anomaly to an admin', async () => {
    anomalyAlert.update.mockResolvedValue({ id: 'a-1', status: 'INVESTIGATING' });

    await service.assignToAdmin('a-1', 'admin-1');

    expect(anomalyAlert.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { assignedToId: 'admin-1', status: 'INVESTIGATING' },
    });
  });

  it('should update anomaly status', async () => {
    anomalyAlert.update.mockResolvedValue({ id: 'a-1', status: 'RESOLVED' });

    await service.updateStatus('a-1', 'RESOLVED');

    expect(anomalyAlert.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { status: 'RESOLVED' },
    });
  });

  it('should broadcast anomaly:detected after creating an anomaly', async () => {
    anomalyAlert.create.mockResolvedValue({
      id: 'a-1',
      anomalyType: 'GEO_FENCE_VIOLATION',
      severity: 'HIGH',
    });

    const result = await service.create({ title: 'fence breach' });

    expect(anomalyAlert.create).toHaveBeenCalledWith({ data: { title: 'fence breach' } });
    expect(gatewayMock.emitToAdmins).toHaveBeenCalledWith('anomaly:detected', {
      anomalyId: 'a-1',
      type: 'GEO_FENCE_VIOLATION',
      severity: 'HIGH',
    });
    expect(result.id).toBe('a-1');
  });
});
