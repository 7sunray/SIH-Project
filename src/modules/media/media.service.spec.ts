import * as crypto from 'crypto';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(() => {
    service = new MediaService();
  });

  it('should build a storage key with sanitized filename', () => {
    expect(service.generateStorageKey('insp-1', 'rep-1', 'my photo.jpg')).toBe(
      'inspections/insp-1/reports/rep-1/my_photo.jpg',
    );
  });

  it('should checksum buffers with sha256', () => {
    const buffer = Buffer.from('evidence');
    const expected = crypto.createHash('sha256').update(buffer).digest('hex');

    expect(service.generateChecksum(buffer)).toBe(expected);
  });

  it('should return a presigned upload descriptor', async () => {
    const result = await service.generatePresignedUploadUrl('insp-1', 'rep-1', 'a b.jpg');

    expect(result.fileKey).toBe('inspections/insp-1/reports/rep-1/a_b.jpg');
    expect(result.uploadUrl).toContain(result.fileKey);
  });
});
