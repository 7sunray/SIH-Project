import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import 'multer';
@Injectable()
export class MediaValidator {
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'video/mp4'];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File size exceeds the 10MB limit.');
    }
  }

  validateChecksum(sha256Hash: string, fileBuffer: Buffer): boolean {
    const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return computedHash === sha256Hash;
  }
}
