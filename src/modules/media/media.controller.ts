import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presigned-url')
  async getPresignedUrl(
    @Body() body: { inspectionId: string; reportId: string; filename: string },
  ) {
    return await this.mediaService.generatePresignedUploadUrl(
      body.inspectionId,
      body.reportId,
      body.filename,
    );
  }


}
