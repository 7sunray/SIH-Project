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

  /** Deadline (days) for a corrective action; configurable, never hardcoded. */
  async correctiveActionDueDays(): Promise<number> {
    try {
      const row = await (this.prisma as any).systemConfig.findUnique({
        where: { key: 'corrective_action_due_days' },
      });
      const days = Number(row?.value);
      if (Number.isFinite(days) && days >= 1 && days <= 90) return Math.floor(days);
    } catch {
      // fall through to default
    }
    return 12;
  }

  /** Full lifecycle state for the judge screen: finding, action, reinspection, closure. */
  async getLifecycle(id: string) {
    const anomaly = await (this.prisma as any).anomalyAlert.findUnique({ where: { id } });
    if (!anomaly) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Anomaly not found');
    }
    const actions = await (this.prisma as any).correctiveAction.findMany({
      where: { anomalyId: id },
      orderBy: { createdAt: 'desc' },
    });
    const action = actions[0] || null;
    let reinspection: any = null;
    if (anomaly.inspectionId) {
      reinspection = await (this.prisma as any).inspection.findUnique({
        where: { id: anomaly.inspectionId },
      });
    }
    return {
      anomaly,
      action,
      reinspection,
      dueDays: await this.correctiveActionDueDays(),
      closed: anomaly.status === 'RESOLVED',
    };
  }

  /**
   * Advances the FINDING -> ACTION -> REINSPECTION -> CLOSURE lifecycle.
   * actions: require-action | submit-response | reinspect | verify-close
   */
  async advanceLifecycle(id: string, body: { action: string; description?: string; note?: string; officerId?: string }) {
    const { BadRequestException, NotFoundException } = await import('@nestjs/common');
    const anomaly = await (this.prisma as any).anomalyAlert.findUnique({ where: { id } });
    if (!anomaly) throw new NotFoundException('Anomaly not found');

    const openAction = await (this.prisma as any).correctiveAction.findFirst({
      where: { anomalyId: id, status: { in: ['PENDING', 'SUBMITTED'] } },
      orderBy: { createdAt: 'desc' },
    });

    switch (body.action) {
      case 'require-action': {
        if (openAction) throw new BadRequestException('A corrective action is already open on this finding.');
        if (!body.description || !body.description.trim()) {
          throw new BadRequestException('A corrective-action description is required.');
        }
        const dueDays = await this.correctiveActionDueDays();
        const dueDate = new Date(Date.now() + dueDays * 86400000);
        await (this.prisma as any).correctiveAction.create({
          data: { anomalyId: id, description: body.description.trim(), dueDate, status: 'PENDING' },
        });
        if (anomaly.status === 'DETECTED') {
          await (this.prisma as any).anomalyAlert.update({ where: { id }, data: { status: 'INVESTIGATING' } });
        }
        break;
      }
      case 'submit-response': {
        if (!openAction || openAction.status !== 'PENDING') {
          throw new BadRequestException('No pending corrective action to respond to.');
        }
        await (this.prisma as any).correctiveAction.update({
          where: { id: openAction.id },
          data: { status: 'SUBMITTED', submittedNote: (body.note || '').slice(0, 2000), submittedAt: new Date() },
        });
        break;
      }
      case 'reinspect': {
        if (!openAction || openAction.status !== 'SUBMITTED') {
          throw new BadRequestException('NGO response must be submitted before reinspection.');
        }
        if (!anomaly.projectId) {
          throw new BadRequestException('Cannot schedule reinspection: finding is not linked to a project.');
        }
        const scheduledDate = new Date(Date.now() + 86400000);
        const inspection = await (this.prisma as any).inspection.create({
          data: {
            projectId: anomaly.projectId,
            assignedOfficerId: body.officerId || undefined,
            status: 'SCHEDULED',
            scheduledDate,
            isRandomAssignment: false,
            notes: 'Reinspection for finding: ' + anomaly.title,
          },
        });
        await (this.prisma as any).anomalyAlert.update({ where: { id }, data: { inspectionId: inspection.id } });
        break;
      }
      case 'verify-close': {
        if (!openAction || openAction.status !== 'SUBMITTED') {
          throw new BadRequestException('NGO response must be submitted before closure.');
        }
        await (this.prisma as any).correctiveAction.update({
          where: { id: openAction.id },
          data: { status: 'VERIFIED' },
        });
        await (this.prisma as any).anomalyAlert.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolutionNote: 'Verified on reinspection. Case closed.',
          },
        });
        break;
      }
      default:
        throw new BadRequestException('Unknown lifecycle action. Use require-action, submit-response, reinspect or verify-close.');
    }

    return this.getLifecycle(id);
  }

}


