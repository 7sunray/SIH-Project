import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';



@Injectable()
export class InspectionAssigner {
  constructor(private readonly prisma: PrismaService) {}

  async assignInspectionRandomly(inspectionId: string, district?: string) {
    // Find eligible officers (e.g., PMU_OFFICER or NGO_STAFF matching district jurisdiction)
    const whereClause: any = {
      role: { in: ['PMU_OFFICER', 'NGO_STAFF'] },
    };

    if (district) {
      whereClause.jurisdictionDist = district;
    }

    const eligibleOfficers = await this.prisma.user.findMany({
      where: whereClause,
    });

    if (!eligibleOfficers || eligibleOfficers.length === 0) {
      throw new BadRequestException('No eligible officers available for assignment in this jurisdiction.');
    }

    // Pick a random officer
    const randomIndex = Math.floor(Math.random() * eligibleOfficers.length);
    const assignedOfficer = eligibleOfficers[randomIndex];

    // Update the inspection with the assigned officer
    return this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        assignedOfficerId: assignedOfficer.id,
        status: 'ASSIGNED' as any,
      },
      include: {
        assignedOfficer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}


