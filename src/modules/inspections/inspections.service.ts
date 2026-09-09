import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InspectionAssigner } from './algorithms/inspection-assigner';
import { MediaValidator } from './validation/media-validator';

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assigner: InspectionAssigner,
    private readonly mediaValidator: MediaValidator,
  ) {}

  async assign(inspectionId: string, district?: string) {
    return await (this.assigner as any).assignInspectionRandomly(inspectionId, district);
  }

  async findAll(query: { status?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    return await (this.prisma as any).inspection.findMany({ where });
  }

  async startInspection(id: string,_userId: string) {
    const inspection = await (this.prisma as any).inspection.findUnique({ where: { id } });
    if (!inspection) throw new NotFoundException('Inspection not found');

    return await (this.prisma as any).inspection.update({
      where: { id },
      data: { status: 'IN_PROGRESS' as any },
    });
  }

  async submitReport(id: string, file: Express.Multer.File, sha256Hash: string, notes: string,_userId: string) {
    this.mediaValidator.validateFile(file);
    const isValid = this.mediaValidator.validateChecksum(sha256Hash, file.buffer);
    
    if (!isValid) {
      throw new Error('File checksum verification failed.');
    }

    return await (this.prisma as any).inspectionReport.create({
      data: {
        inspectionId: id,
        submittedById:_userId,
        narrativeNotes: notes,
        submittedAt: new Date(),
      },
    });
  }
}

