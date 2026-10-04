import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

// Legacy format written by src/common/utils/encryption.util.ts (hex parts,
// key = sha256(ENCRYPTION_KEY)). Still accepted on decrypt so existing rows
// (e.g. stored RTSP URLs) keep working after migrating to this service.
const LEGACY_DEFAULT_SECRET = 'default_32_byte_secret_key_change_me!!';
const LEGACY_IV_RE = /^[0-9a-fA-F]{24}$/;
const LEGACY_TAG_RE = /^[0-9a-fA-F]{32}$/;

/**
 * AES-256-GCM encryption for sensitive fields at rest:
 * RTSP URLs, TOTP secrets, VC room/participant tokens.
 *
 * encrypt() returns `iv:authTag:ciphertext` with every part base64-encoded.
 *
 * Key resolution order:
 *  1. ENCRYPTION_KEY env var (32 raw bytes as base64, 64-char hex, or 32-char string)
 *  2. AWS KMS (extension point — see resolveKey): values starting with
 *     `kms:` / `arn:aws:kms:` throw an actionable error until a KMS client is wired.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(@Optional() configService?: ConfigService) {
    const raw =
      configService?.get<string>('ENCRYPTION_KEY') ?? process.env.ENCRYPTION_KEY;
    this.key = EncryptionService.resolveKey(raw);
  }

  static resolveKey(raw: string | undefined): Buffer {
    if (raw === undefined || raw.trim() === '') {
      throw new Error(
        'ENCRYPTION_KEY is not set. Provide 32 random bytes as base64 ' +
          '(e.g. `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"`) ' +
          'or 64 hex characters.',
      );
    }
    const value = raw.trim();
    if (/^[0-9a-fA-F]{64}$/.test(value)) {
      return Buffer.from(value, 'hex');
    }
    if (/^(kms:|arn:aws:kms:)/i.test(value)) {
      // Extension point: call KMS Decrypt/GenerateDataKey here and return the
      // 32-byte plaintext data key. No KMS client is installed yet on purpose —
      // adding @aws-sdk/client-kms just for this would bloat the bundle.
      throw new Error(
        'ENCRYPTION_KEY points at AWS KMS, but KMS data-key resolution is not ' +
          'configured. Either set a static key or implement KMS Decrypt in ' +
          'EncryptionService.resolveKey().',
      );
    }
    const fromBase64 = Buffer.from(value, 'base64');
    if (fromBase64.length === KEY_LENGTH_BYTES) {
      return fromBase64;
    }
    if (Buffer.byteLength(value, 'utf8') === KEY_LENGTH_BYTES) {
      return Buffer.from(value, 'utf8');
    }
    throw new Error(
      'ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 bytes, ' +
        '64 hex chars, or a 32-char string).',
    );
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload: expected iv:authTag:ciphertext');
    }
    if (LEGACY_IV_RE.test(parts[0]) && LEGACY_TAG_RE.test(parts[1])) {
      return EncryptionService.legacyDecrypt(payload);
    }
    try {
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(parts[0], 'base64'),
      );
      decipher.setAuthTag(Buffer.from(parts[1], 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parts[2], 'base64')),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch (err) {
      this.logger.warn(`decrypt failed: ${(err as Error).message}`);
      throw new Error('Failed to decrypt payload (wrong key or tampered data)');
    }
  }

  /** Decrypts rows written by the legacy hex-format encryption.util. */
  private static legacyDecrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    const secret = process.env.ENCRYPTION_KEY || LEGACY_DEFAULT_SECRET;
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
