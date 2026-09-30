import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateInstituteDto } from './dto/create-institute.dto';
import { UpdateInstituteDto } from './dto/update-institute.dto';
import { QueryInstituteDto } from './dto/query-institute.dto';

@Injectable()
export class InstitutesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateInstituteDto) {
    const { name, address, latitude, longitude } = createDto;
    return this.prisma.$executeRaw`
      INSERT INTO institute_ngos (id, name, address, location, created_at)
      VALUES (uuid_generate_v4(), ${name}, ${address}, 
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), NOW());
    `;
  }

  async findAll(queryDto: QueryInstituteDto) {
    const { search, page = 1, limit = 10 } = queryDto;
    const offset = (page - 1) * limit;

    // NOTE: columns are camelCase in this database (Prisma db push, no @map).
    if (search) {
      const searchTerm = `%${search}%`;
      return this.prisma.$queryRaw`
        SELECT id, name, "registrationNo", type, "contactEmail", "addressLine1", state, district, status,
               ST_Y(location) AS lat, ST_X(location) AS lng
        FROM institute_ngos
        WHERE name ILIKE ${searchTerm} OR "registrationNo" ILIKE ${searchTerm} OR district ILIKE ${searchTerm}
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    return this.prisma.$queryRaw`
      SELECT id, name, "registrationNo", type, "contactEmail", "addressLine1", state, district, status,
             ST_Y(location) AS lat, ST_X(location) AS lng
      FROM institute_ngos
      LIMIT ${limit} OFFSET ${offset};
    `;
  }

  async findOne(id: string) {
    return this.prisma.$queryRaw`SELECT id, name, "registrationNo", type, "contactEmail", "addressLine1", state, district, status, ST_Y(location) AS lat, ST_X(location) AS lng FROM institute_ngos WHERE id = ${id}::uuid;`;
  }

  async update(id: string,_updateDto: UpdateInstituteDto) {
    return `Institute ${id} updated`;
  }

  async remove(id: string) {
    return this.prisma.$executeRaw`DELETE FROM institute_ngos WHERE id = ${id}::uuid;`;
  }
}