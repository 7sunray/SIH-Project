import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly privateKey = fs.readFileSync('keys/jwt-private.pem', 'utf8');
  private readonly publicKey = fs.readFileSync('keys/jwt-public.pem', 'utf8');

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Issues an access + refresh pair and persists the refresh-token hash. */
  private async issuePair(
    user: { id: string; email: string; role: string },
    deviceLabel?: string,
  ) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      privateKey: this.privateKey,
      algorithm: 'RS256',
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      { privateKey: this.privateKey, algorithm: 'RS256', expiresIn: '7d' },
    );
    const decoded: any = this.jwtService.decode(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        userAgent: deviceLabel?.slice(0, 512),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active.');
    }
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked.');
    }
    const ok = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    await this.prisma.user
      .update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lastLoginAt: new Date() },
      })
      .catch(() => null);
    return this.issuePair(
      { id: user.id, email: user.email, role: user.role },
      loginDto.deviceFingerprint,
    );
  }

  /** Validates a refresh token, rotates it, and returns a fresh pair. */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required.');
    }
    try {
      this.jwtService.verify(refreshToken, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.sha256(refreshToken) },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked.');
    }
    // Rotate: revoke the presented token before issuing replacements.
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), rotatedAt: new Date() },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active.');
    }
    return this.issuePair({ id: user.id, email: user.email, role: user.role });
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
