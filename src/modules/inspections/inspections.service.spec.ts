import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { InspectionsService } from './inspections.service';
import { InspectionAssigner } from './algorithms/inspection-assigner';
import { MediaValidator } from './validation/media-validator';

describe('InspectionsService', () => {
  let service: InspectionsService;

  const inspection = { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() };
  const inspectionReport = { create: jest.fn() };
  const prismaMock: any = { inspection, inspectionReport };
  const assignerMock = { assignInspectionRandomly: jest.fn() };
  const mediaValidatorMock = { validateFile: jest.fn(), validateChecksum: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InspectionAssigner, useValue: assignerMock },
        { provide: MediaValidator, useValue: mediaValidatorMock },
      ],
    }).compile();

    service = module.get<InspectionsService>(InspectionsService);
  });

  it('should create inspection assignment', async () => {
    assignerMock.assignInspectionRandomly.mockResolvedValue({ officerId: 'officer-1' });

    const result = await service.assign('inspection-1', 'Central');

    expect(assignerMock.assignInspectionRandomly).toHaveBeenCalledWith(
      'inspection-1',
      'Central',
    );
    expect(result).toEqual({ officerId: 'officer-1' });
  });

  it('should filter inspections by status', async () => {
    inspection.findMany.mockResolvedValue([{ id: 'i-1' }]);

    const result = await service.findAll({ status: 'SCHEDULED' });

    expect(inspection.findMany).toHaveBeenCalledWith({ where: { status: 'SCHEDULED' } });
    expect(result).toEqual([{ id: 'i-1' }]);
  });

  it('should start an inspection', async () => {
    inspection.findUnique.mockResolvedValue({ id: 'i-1', status: 'SCHEDULED' });
    inspection.update.mockResolvedValue({ id: 'i-1', status: 'IN_PROGRESS' });

    const result = await service.startInspection('i-1', 'user-1');

    expect(inspection.update).toHaveBeenCalledWith({
      where: { id: 'i-1' },
      data: { status: 'IN_PROGRESS' },
    });
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('should throw when starting a missing inspection', async () => {
    inspection.findUnique.mockResolvedValue(null);

    await expect(service.startInspection('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject a report with a bad checksum', async () => {
    const file = { buffer: Buffer.from('bytes') } as Express.Multer.File;
    mediaValidatorMock.validateChecksum.mockReturnValue(false);

    await expect(
      service.submitReport('i-1', file, 'bad-hash', 'notes', 'user-1'),
    ).rejects.toThrow('File checksum verification failed.');
    expect(inspectionReport.create).not.toHaveBeenCalled();
  });

  it('should submit a report with a valid checksum', async () => {
    const file = { buffer: Buffer.from('bytes') } as Express.Multer.File;
    mediaValidatorMock.validateChecksum.mockReturnValue(true);
    inspectionReport.create.mockResolvedValue({ id: 'r-1' });

    const result = await service.submitReport('i-1', file, 'good-hash', 'notes', 'user-1');

    expect(mediaValidatorMock.validateFile).toHaveBeenCalledWith(file);
    expect(inspectionReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ inspectionId: 'i-1', submittedById: 'user-1' }),
    });
    expect(result).toEqual({ id: 'r-1' });
  });
});
