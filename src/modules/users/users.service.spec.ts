import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from './users.service';
import { UserRole } from './dto/create-user.dto';

describe('UsersService', () => {
  let service: UsersService;

  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prismaMock: any = { user };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user with a hashed password', async () => {
    user.findUnique.mockResolvedValue(null);
    user.create.mockImplementation(async ({ data }: any) => ({ id: 'u-1', ...data }));

    const result = await service.create({
      email: 'a@dosje.local',
      password: 'secret123',
      name: 'Jane Doe',
      role: UserRole.PMU_OFFICER,
    });

    expect(user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'a@dosje.local',
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.PMU_OFFICER,
      }),
      select: expect.anything(),
    });
    await expect(bcrypt.compare('secret123', result.passwordHash)).resolves.toBe(true);
  });

  it('should reject a duplicate email', async () => {
    user.findUnique.mockResolvedValue({ id: 'u-1' });

    await expect(
      service.create({
        email: 'a@dosje.local',
        password: 'secret123',
        name: 'Jane Doe',
        role: UserRole.PMU_OFFICER,
      }),
    ).rejects.toThrow(ConflictException);
    expect(user.create).not.toHaveBeenCalled();
  });

  it('should paginate users', async () => {
    user.findMany.mockResolvedValue([]);
    user.count.mockResolvedValue(0);

    const result = await service.findAll({ search: 'x', page: 2, limit: 5 } as any);

    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta).toEqual({ total: 0, page: 2, limit: 5, totalPages: 0 });
  });

  it('should throw when the user is missing', async () => {
    user.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should update and remove users', async () => {
    user.update.mockResolvedValue({ id: 'u-1' });
    user.delete.mockResolvedValue({ id: 'u-1' });

    await service.update('u-1', { name: 'New Name' } as any);
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' } }),
    );

    await service.remove('u-1');
    expect(user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
  });
});
