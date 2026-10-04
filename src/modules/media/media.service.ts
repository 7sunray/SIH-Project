import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MediaService {
 
  generateStorageKey(inspectionId: string, reportId: string, filename: string): string {
    const cleanFilename = filename.replace(/\s+/g, '_');
    return `inspections/${inspectionId}/reports/${reportId}/${cleanFilename}`;
  }

 
  generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async generatePresignedUploadUrl(inspectionId: string, reportId: string, filename: string) {
    const key = this.generateStorageKey(inspectionId, reportId, filename);
    
    return {
      uploadUrl: `https://your-s3-bucket.s3.amazonaws.com/${key}?sig=mock`,
      fileKey: key,
    };
  }
}
