import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardOverview() {
    return this.analyticsService.getDashboardOverview();
  }

  @Get('anomalies')
  getAnomalyAggregations() {
    return this.analyticsService.getAnomalyAggregations();
  }

  @Get('inspections')
  getInspectionStatistics() {
    return this.analyticsService.getInspectionStatistics();
  }
}
