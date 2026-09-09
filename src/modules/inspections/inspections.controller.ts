import { Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('inspections')
@UseGuards(JwtAuthGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post('assign')
  assign(@Body() body: { inspectionId: string; district?: string }) {
    return this.inspectionsService.assign(body.inspectionId, body.district);
  }

  @Get()
  findAll(@Query() query: { status?: string; search?: string }) {
    return this.inspectionsService.findAll(query);
  }

  @Post(':id/start')
  startInspection(@Param('id') id: string, @Req() req: any) {
    return this.inspectionsService.startInspection(id, req.user.userId);
  }

  @Post(':id/submit-report')
  @UseInterceptors(FileInterceptor('file'))
  submitReport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('sha256Hash') sha256Hash: string,
    @Body('notes') notes: string,
    @Req() req: any,
  ) {
    return this.inspectionsService.submitReport(id, file, sha256Hash, notes, req.user.userId);
  }
}
