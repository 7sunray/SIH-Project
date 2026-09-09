import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';
import { AnomalyProcessWorker } from './anomaly-process.worker';

describe('AnomalyProcessWorker', () => {
  let worker: AnomalyProcessWorker;
  const gatewayMock = { emitToAdmins: jest.fn() };
  const prismaMock: any = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyProcessWorker,
        { provide: EventsGateway, useValue: gatewayMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    worker = module.get<AnomalyProcessWorker>(AnomalyProcessWorker);
  });

  it('should emit anomaly:detected after processing a job', async () => {
    const job: any = {
      id: '1',
      data: { anomalyId: 'a-1', type: 'CCTV_FEED_INTERRUPTED', severity: 'HIGH' },
    };

    const result = await worker.process(job);

    expect(gatewayMock.emitToAdmins).toHaveBeenCalledWith('anomaly:detected', {
      anomalyId: 'a-1',
      type: 'CCTV_FEED_INTERRUPTED',
      severity: 'HIGH',
    });
    expect(result).toEqual(expect.objectContaining({ processed: true, anomalyId: 'a-1' }));
  });
});
