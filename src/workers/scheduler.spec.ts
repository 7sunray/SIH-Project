import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue-definitions';
import { SchedulerService } from './scheduler';

describe('SchedulerService', () => {
  let service: SchedulerService;
  const cctvQueue = {
    upsertJobScheduler: jest.fn(),
    getJobSchedulers: jest.fn().mockResolvedValue([]),
    removeJobScheduler: jest.fn(),
  };
  const analyticsQueue = {
    upsertJobScheduler: jest.fn(),
    getJobSchedulers: jest.fn().mockResolvedValue([]),
    removeJobScheduler: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getQueueToken(QUEUES.CCTV_HEALTH), useValue: cctvQueue },
        { provide: getQueueToken(QUEUES.ANALYTICS_AGGREGATE), useValue: analyticsQueue },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should register cron jobs', async () => {
    await service.registerCronJobs();

    expect(cctvQueue.upsertJobScheduler).toHaveBeenCalledWith(
      'cron-cctv-health',
      { every: 30_000 },
      { name: 'health-ping', data: {} },
    );
    expect(analyticsQueue.upsertJobScheduler).toHaveBeenCalledWith(
      'cron-analytics-aggregate',
      { pattern: '0 0 * * *' },
      { name: 'daily-aggregate', data: {} },
    );
  });
});
