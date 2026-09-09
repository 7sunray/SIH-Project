import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateProjectDto) {
    const { 
      name, description, budget, radiusMeters, 
      schemeCode, sanctionedAmount, beneficiaryCount, 
      latitude, longitude 
    } = createDto;

    return this.prisma.$executeRaw`
      INSERT INTO projects (
        id, name, description, budget, radius_meters, 
        scheme_code, sanctioned_amount, beneficiary_count, 
        location, created_at
      )
      VALUES (
        uuid_generate_v4(), ${name}, ${description}, ${budget}, ${radiusMeters}, 
        ${schemeCode}, ${sanctionedAmount}, ${beneficiaryCount}, 
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), NOW()
      );
    `;
  }

  async findAll(queryDto: QueryProjectDto) {
    const { search, page = 1, limit = 10 } = queryDto;
    const offset = (page - 1) * limit;

    if (search) {
      const searchTerm = `%${search}%`;
      return this.prisma.$queryRaw`
        SELECT id, name, description, budget, radius_meters, scheme_code, 
               sanctioned_amount, beneficiary_count, ST_AsText(location) as location 
        FROM projects 
        WHERE name ILIKE ${searchTerm} OR description ILIKE ${searchTerm}
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    return this.prisma.$queryRaw`
      SELECT id, name, description, budget, radius_meters, scheme_code, 
             sanctioned_amount, beneficiary_count, ST_AsText(location) as location 
      FROM projects 
      LIMIT ${limit} OFFSET ${offset};
    `;
  }

  async findOne(id: string) {
    return this.prisma.$queryRaw`
      SELECT id, name, description, budget, radius_meters, scheme_code, 
             sanctioned_amount, beneficiary_count, ST_AsText(location) as location 
      FROM projects 
      WHERE id = ${id}::uuid;
    `;
  }

  async update(id: string,_updateDto: UpdateProjectDto) {
    return `Project ${id} updated successfully`;
  }

  async remove(id: string) {
    return this.prisma.$executeRaw`DELETE FROM projects WHERE id = ${id}::uuid;`;
  }
}