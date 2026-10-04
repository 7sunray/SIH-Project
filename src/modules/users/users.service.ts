import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

async create(createDto: CreateUserDto) {
    const { email, password, name, role, state, district } = createDto;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Split name into firstName and lastName if needed, or map directly
    const [firstName, ...lastNameArr] = name.split(' ');
    const lastName = lastNameArr.join(' ') || '';

    return this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: role as Role,
        jurisdictionState: state,
        jurisdictionDist: district,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        jurisdictionState: true,
        jurisdictionDist: true,
        createdAt: true,
      },
    });
  }

  async findAll(queryDto: QueryUserDto) {
    const { search, role, page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          jurisdictionState: true,
          jurisdictionDist: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        jurisdictionState: true,
        jurisdictionDist: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateDto: UpdateUserDto) {
    // Translate DTO fields to real User columns (name -> first/last,
    // password -> passwordHash, state/district -> jurisdiction*).
    const { name, password, state, district, ...rest } = updateDto as any;
    const data: any = { ...rest };
    if (name) {
      const [firstName, ...lastNameArr] = String(name).split(' ');
      data.firstName = firstName;
      data.lastName = lastNameArr.join(' ') || '';
    }
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    if (state !== undefined) data.jurisdictionState = state;
    if (district !== undefined) data.jurisdictionDist = district;
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        jurisdictionState: true,
        jurisdictionDist: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
