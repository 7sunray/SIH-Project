import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = {
    sign: jest.fn(() => 'mocked_jwt-token'),
    verify: jest.fn(),
    decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
  };

  const mockPrisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('login with correct credentials returns tokens and stores refresh hash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      passwordHash: 'hash',
      role: 'DOSJE_ADMIN',
      status: 'ACTIVE',
      lockoutUntil: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'a@b.c',
      password: 'password123',
      deviceFingerprint: 'my-device',
    });

    expect(result.accessToken).toEqual('mocked_jwt-token');
    expect(result.refreshToken).toEqual('mocked_jwt-token');
    expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
  });

  it('login with wrong password throws Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      passwordHash: 'hash',
      role: 'DOSJE_ADMIN',
      status: 'ACTIVE',
      lockoutUntil: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'a@b.c',
        password: 'wrong-password',
        deviceFingerprint: 'my-device',
      }),
    ).rejects.toThrow('Invalid email or password.');
  });

  it('refresh with valid stored token rotates and returns a new pair', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 'u1' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      role: 'DOSJE_ADMIN',
      status: 'ACTIVE',
    });

    const result = await service.refresh('old_valid_token');

    expect(result.accessToken).toEqual('mocked_jwt-token');
    expect(mockPrisma.refreshToken.update).toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
  });

  it('refresh with garbage throws Unauthorized', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(service.refresh('garbage')).rejects.toThrow();
  });
});
