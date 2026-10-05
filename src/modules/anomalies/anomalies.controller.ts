import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AnomaliesService } from './anomalies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('anomalies')
@UseGuards(JwtAuthGuard)
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Get()
  findAll(@Query() query: { type?: string; severity?: string; status?: string }) {
    return this.anomaliesService.findAll(query);
  }

  @Patch(':id/assign')
  assignToAdmin(@Param('id') id: string, @Body('adminId') adminId: string) {
    return this.anomaliesService.assignToAdmin(id, adminId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.anomaliesService.updateStatus(id, status);
  }

  @Get(':id/lifecycle')
  getLifecycle(@Param('id') id: string) {
    return this.anomaliesService.getLifecycle(id);
  }

  @Post(':id/lifecycle')
  advanceLifecycle(
    @Param('id') id: string,
    @Body() body: { action: string; description?: string; note?: string; officerId?: string },
  ) {
    return this.anomaliesService.advanceLifecycle(id, body);
  }
}
