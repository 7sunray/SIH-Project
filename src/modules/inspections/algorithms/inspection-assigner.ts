// src/modules/inspection/algorithms/inspection-assigner.ts

import { InspectionStatus } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

interface AssignmentCandidate {
  officerId: string;
  officerName: string;
  latitude: number;
  longitude: number;
  currentWorkload: number;       // active inspections this cycle
  totalInspectionsLast90d: number;
  lastInspectedNgoIds: string[]; // for conflict-of-interest check
}

interface ProjectToAssign {
  projectId: string;
  instituteNgoId: string;
  ngoName: string;
  latitude: number;
  longitude: number;
  lastInspectionDate: Date | null;
  daysSinceLastInspection: number;
  priorityScore: number;
}

interface AssignmentResult {
  officerId: string;
  projectId: string;
  distanceKm: number;
  conflictFree: boolean;
  workloadBefore: number;
}

@Injectable()
export class InspectionAssigner {
  
  private readonly logger = new Logger(InspectionAssigner.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs the full random assignment cycle.
   * Returns array of { officerId, projectId } pairs.
   */
  async runAssignmentCycle(): Promise<AssignmentResult[]> {
    this.logger.log('Starting inspection assignment cycle');

    // 1. Fetch available officers (PMU_OFFICER role, active, within jurisdiction)
    const officers = await this.getAvailableOfficers();
    this.logger.log(`Found ${officers.length} available officers`);

    // 2. Fetch projects needing inspection
    const projects = await this.getProjectsNeedingInspection();
    this.logger.log(`Found ${projects.length} projects needing inspection`);

    if (officers.length === 0 || projects.length === 0) {
      this.logger.warn('No officers or projects available for assignment');
      return [];
    }

    // 3. Build a distance matrix (officer × project)
    const distanceMatrix = this.buildDistanceMatrix(officers, projects);

    // 4. Run the assignment algorithm
    const assignments = this.greedyWeightedAssignment(
      officers,
      projects,
      distanceMatrix,
    );

    // 5. Persist assignments to DB
    const batchId = crypto.randomUUID();
    await this.persistAssignments(assignments, batchId);

    this.logger.log(`Assigned ${assignments.length} inspections in batch ${batchId}`);
    return assignments;
  }

  private async getAvailableOfficers(): Promise<AssignmentCandidate[]> {
    const officers = await this.prisma.$queryRaw<
      Array<{
        officer_id: string;
        first_name: string;
        last_name: string;
        lat: number;
        lng: number;
        current_workload: bigint;
        total_inspections_90d: bigint;
      }>
    >`
      SELECT
        u.id AS officer_id,
        u.first_name,
        u.last_name,
        ST_Y(u_location.location)::float AS lat,
        ST_X(u_location.location)::float AS lng,
        COALESCE(wl.current_workload, 0) AS current_workload,
        COALESCE(wl.total_90d, 0) AS total_inspections_90d
      FROM users u
      -- Officer's base location derived from jurisdiction centroid
      -- (in production, officers have a separate location table updated via mobile GPS)
      CROSS JOIN LATERAL (
        SELECT ST_Centroid(
          ST_Collect(p.location)
        ) AS location
        FROM projects p
        WHERE p.state = u.jurisdiction_state
          AND p.district = u.jurisdiction_district
        LIMIT 1
      ) u_location
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE i.status IN ('SCHEDULED', 'IN_PROGRESS')) AS current_workload,
          COUNT(*) FILTER (WHERE i.created_at > NOW() - INTERVAL '90 days') AS total_90d
        FROM inspections i
        WHERE i.assigned_officer_id = u.id
      ) wl ON true
      WHERE u.role = 'PMU_OFFICER'
        AND u.status = 'ACTIVE'
        AND u.deleted_at IS NULL
        AND (u.lockout_until IS NULL OR u.lockout_until < NOW())
    `;

    // Fetch last-inspected NGO IDs per officer (for conflict-of-interest)
    const officerIds = officers.map((o) => o.officer_id);
    const recentInspections = await this.prisma.$queryRaw<
      Array<{ officer_id: string; ngo_ids: string[] }>
    >`
      SELECT
        i.assigned_officer_id AS officer_id,
        ARRAY_AGG(DISTINCT p.institute_ngo_id) AS ngo_ids
      FROM inspections i
      JOIN projects p ON p.id = i.project_id
      WHERE i.assigned_officer_id = ANY(${officerIds}::uuid[])
        AND i.created_at > NOW() - INTERVAL '6 months'
        AND i.status != 'REJECTED'
      GROUP BY i.assigned_officer_id
    `;

    const ngoMap = new Map<string, string[]>();
    for (const row of recentInspections) {
      ngoMap.set(row.officer_id, row.ngo_ids);
    }

    return officers.map((o) => ({
      officerId: o.officer_id,
      officerName: `${o.first_name} ${o.last_name}`,
      latitude: o.lat,
      longitude: o.lng,
      currentWorkload: Number(o.current_workload),
      totalInspectionsLast90d: Number(o.total_inspections_90d),
      lastInspectedNgoIds: ngoMap.get(o.officer_id) || [],
    }));
  }

  private async getProjectsNeedingInspection(): Promise<ProjectToAssign[]> {
    const projects = await this.prisma.$queryRaw<
      Array<{
        project_id: string;
        institute_ngo_id: string;
        ngo_name: string;
        lat: number;
        lng: number;
        last_inspection_date: Date | null;
        days_since: bigint;
        priority_score: number;
      }>
    >`
      SELECT
        p.id AS project_id,
        p.institute_ngo_id,
        i.name AS ngo_name,
        ST_Y(p.location)::float AS lat,
        ST_X(p.location)::float AS lng,
        li.last_date AS last_inspection_date,
        COALESCE(
          EXTRACT(DAY FROM (NOW() - li.last_date))::bigint,
          999
        ) AS days_since,
        -- Priority: higher if never inspected, or if overdue by many days
        CASE
          WHEN li.last_date IS NULL THEN 100.0
          ELSE LEAST(100.0, 10.0 + (EXTRACT(DAY FROM NOW() - li.last_date) / 30.0) * 10.0)
        END AS priority_score
      FROM projects p
      JOIN institute_ngos i ON i.id = p.institute_ngo_id
      LEFT JOIN LATERAL (
        SELECT MAX(i2.scheduled_date) AS last_date
        FROM inspections i2
        WHERE i2.project_id = p.id
          AND i2.status IN ('APPROVED', 'REPORT_SUBMITTED', 'REPORT_UNDER_REVIEW')
      ) li ON true
      WHERE p.status IN ('IN_PROGRESS', 'UNDER_INSPECTION')
        AND p.deleted_at IS NULL
        AND i.status = 'ACTIVE'
        -- Filter: only projects without a pending/active inspection
        AND NOT EXISTS (
          SELECT 1 FROM inspections i3
          WHERE i3.project_id = p.id
            AND i3.status IN ('SCHEDULED', 'IN_PROGRESS')
        )
      ORDER BY priority_score DESC, days_since DESC
    `;

    return projects.map((p) => ({
      projectId: p.project_id,
      instituteNgoId: p.institute_ngo_id,
      ngoName: p.ngo_name,
      latitude: p.lat,
      longitude: p.lng,
      lastInspectionDate: p.last_inspection_date,
      daysSinceLastInspection: Number(p.days_since),
      priorityScore: Number(p.priority_score),
    }));
  }

  /**
   * Haversine distance in km between two lat/lng pairs.
   */
  private haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private buildDistanceMatrix(
    officers: AssignmentCandidate[],
    projects: ProjectToAssign[],
  ): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();
    for (const officer of officers) {
      const row = new Map<string, number>();
      for (const project of projects) {
        row.set(
          project.projectId,
          this.haversineDistance(
            officer.latitude, officer.longitude,
            project.latitude, project.longitude,
          ),
        );
      }
      matrix.set(officer.officerId, row);
    }
    return matrix;
  }

  /**
   * Weighted scoring function that combines:
   * - Geographic proximity (distance)
   * - Workload balancing (prefer lower workload)
   * - Inspection freshness (prefer overdue projects)
   * - Conflict-of-interest penalty (avoid re-inspecting same NGO)
   */
  private computeScore(
    officer: AssignmentCandidate,
    project: ProjectToAssign,
    distance: number,
  ): number {
    // Distance score: 0–100, closer is better (exponential decay)
    const distanceScore = 100 * Math.exp(-0.05 * distance);

    // Workload score: 0–100, fewer active inspections is better
    const maxWorkload = 10;
    const workloadScore =
      100 * (1 - Math.min(officer.currentWorkload, maxWorkload) / maxWorkload);

    // Freshness score: directly from priority
    const freshnessScore = project.priorityScore;

    // Conflict-of-interest: if officer recently inspected this NGO,
    // apply a heavy penalty (0 = full penalty, 1 = no penalty)
    const conflictFree = !officer.lastInspectedNgoIds.includes(project.instituteNgoId);
    const conflictMultiplier = conflictFree ? 1.0 : 0.05; // 95% penalty

    // Recency penalty: officer who has had fewer inspections recently gets a boost
    const recencyScore =
      100 * (1 - Math.min(officer.totalInspectionsLast90d, 60) / 60);

    // Weighted combination
    const raw =
      0.30 * distanceScore +
      0.25 * workloadScore +
      0.25 * freshnessScore +
      0.20 * recencyScore;

    return raw * conflictMultiplier;
  }

  /**
   * Greedy assignment with workload balancing.
   * Iteratively assigns the highest-scoring (officer, project) pair,
   * then removes both from the pool until one side is exhausted.
   */
  private greedyWeightedAssignment(
    officers: AssignmentCandidate[],
    projects: ProjectToAssign[],
    distanceMatrix: Map<string, Map<string, number>>,
  ): AssignmentResult[] {
    const assignments: AssignmentResult[] = [];
    const assignedOfficerIds = new Set<string>();
    const assignedProjectIds = new Set<string>();

    // Sort officers by current workload ascending (fair distribution)
    const sortedOfficers = [...officers].sort(
      (a, b) => a.currentWorkload - b.currentWorkload,
    );

    // Repeat: find the globally best scoring pair
    while (assignedOfficerIds.size < sortedOfficers.length && assignedProjectIds.size < projects.length) {
      let bestScore = -1;
      let bestOfficer: AssignmentCandidate | null = null;
      let bestProject: ProjectToAssign | null = null;
      let bestDistance = 0;

      for (const officer of sortedOfficers) {
        if (assignedOfficerIds.has(officer.officerId)) continue;
        // Soft cap: max 5 concurrent pending inspections per officer
        if (officer.currentWorkload + assignments.filter(a => a.officerId === officer.officerId).length >= 5) continue;

        for (const project of projects) {
          if (assignedProjectIds.has(project.projectId)) continue;

          const distance = distanceMatrix.get(officer.officerId)!.get(project.projectId)!;
          const score = this.computeScore(officer, project, distance);

          if (score > bestScore) {
            bestScore = score;
            bestOfficer = officer;
            bestProject = project;
            bestDistance = distance;
          }
        }
      }

      if (!bestOfficer || !bestProject) break;

      assignments.push({
        officerId: bestOfficer.officerId,
        projectId: bestProject.projectId,
        distanceKm: Math.round(bestDistance * 100) / 100,
        conflictFree: !bestOfficer.lastInspectedNgoIds.includes(bestProject.instituteNgoId),
        workloadBefore: bestOfficer.currentWorkload,
      });

      assignedOfficerIds.add(bestOfficer.officerId);
      assignedProjectIds.add(bestProject.projectId);
    }

    return assignments;
  }

  private async persistAssignments(
    assignments: AssignmentResult[],
    batchId: string,
  ): Promise<void> {
    const _now=new Date();
    const schedulingDate = new Date();
    schedulingDate.setDate(schedulingDate.getDate() + 1); // schedule for tomorrow

    await this.prisma.$transaction(
      assignments.map((a) =>
        this.prisma.inspection.create({
          data: {
            projectId: a.projectId,
            assignedOfficerId: a.officerId,
            status: InspectionStatus.SCHEDULED,
            scheduledDate: schedulingDate,
            isRandomAssignment: true,
            assignmentBatchId: batchId,
          },
        }),
      ),
    );
  }
}