import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CctvService } from './cctv.service';

describe('CctvService', () => {
  let service: CctvService;

  const prismaMock: any = { $executeRaw: jest.fn(), $queryRaw: jest.fn() };
  const encryptionMock = { encrypt: jest.fn(), decrypt: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CctvService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EncryptionService, useValue: encryptionMock },
      ],
    }).compile();

    service = module.get<CctvService>(CctvService);
  });

  it('should encrypt the RTSP url on create', async () => {
    encryptionMock.encrypt.mockReturnValue('enc-url');
    prismaMock.$executeRaw.mockResolvedValue(1);

    await service.create({
      name: 'gate-cam',
      rtspUrl: 'rtsp://plain',
      latitude: 1,
      longitude: 2,
    } as any);

    expect(encryptionMock.encrypt).toHaveBeenCalledWith('rtsp://plain');
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('should decrypt feed urls on findAll', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'c-1', rtsp_url: 'enc-url' },
      { id: 'c-2', rtsp_url: null },
    ]);
    encryptionMock.decrypt.mockReturnValue('rtsp://plain');

    const result = await service.findAll({});

    expect(encryptionMock.decrypt).toHaveBeenCalledWith('enc-url');
    expect(result).toEqual([
      { id: 'c-1', rtsp_url: 'rtsp://plain' },
      { id: 'c-2', rtsp_url: null },
    ]);
  });

  it('should return null for a missing feed', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });

  it('should remove a feed', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1);

    await service.remove('c-1');

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
