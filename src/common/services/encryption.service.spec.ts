import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

describe('EncryptionService', () => {
  let service: EncryptionService;
  const previousKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = previousKey;
  });

  it('should round-trip plaintext in iv:authTag:ciphertext (base64) format', () => {
    const ciphertext = service.encrypt('rtsp://cam:pw@host/stream');

    expect(ciphertext.split(':')).toHaveLength(3);
    expect(service.decrypt(ciphertext)).toBe('rtsp://cam:pw@host/stream');
  });

  it('should use a fresh IV for every encryption', () => {
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('should reject tampered payloads', () => {
    const ciphertext = service.encrypt('secret');
    const tampered = `${ciphertext.slice(0, -2)}AA`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should still decrypt legacy hex-format rows', () => {
    const legacyKey = crypto.createHash('sha256').update(TEST_KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
    const data = Buffer.concat([cipher.update('legacy-rtsp', 'utf8'), cipher.final()]);
    const legacy = `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;

    expect(service.decrypt(legacy)).toBe('legacy-rtsp');
  });

  it('should reject malformed payloads and bad keys', () => {
    expect(() => service.decrypt('not-a-payload')).toThrow();
    expect(() => EncryptionService.resolveKey(undefined)).toThrow();
    expect(() => EncryptionService.resolveKey('too-short')).toThrow();
  });
});
