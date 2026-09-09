import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCctvDto } from './create-cctv.dto';
import { UpdateCctvDto } from './update-cctv.dto';
import { QueryCctvDto } from './query-cctv.dto';
import { encrypt, decrypt } from '../../common/utils/encryption.util';

@Injectable()
export class CctvService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCctvDto) {
    const { name, rtspUrl, status, latitude, longitude } = createDto;
    const encryptedUrl = encrypt(rtspUrl);

    return this.prisma.$executeRaw`
      INSERT INTO cctv_feeds (id, name, rtsp_url, status, location, created_at)
      VALUES (
        uuid_generate_v4(), ${name}, ${encryptedUrl}, ${status || 'OFFLINE'}, 
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), NOW()
      );
    `;
  }

  async findAll(queryDto: QueryCctvDto) {
    const { search, status, page = 1, limit = 10 } = queryDto;
    const offset = (page - 1) * limit;

    let results: any[] = [];

    if (search && status) {
      const searchTerm = `%${search}%`;
      results = await this.prisma.$queryRaw`
        SELECT id, name, rtsp_url, status, ST_AsText(location) as location 
        FROM cctv_feeds 
        WHERE (name ILIKE ${searchTerm}) AND status = ${status}::text
        LIMIT ${limit} OFFSET ${offset};
      `;
    } else if (search) {
      const searchTerm = `%${search}%`;
      results = await this.prisma.$queryRaw`
        SELECT id, name, rtsp_url, status, ST_AsText(location) as location 
        FROM cctv_feeds 
        WHERE name ILIKE ${searchTerm}
        LIMIT ${limit} OFFSET ${offset};
      `;
    } else if (status) {
      results = await this.prisma.$queryRaw`
        SELECT id, name, rtsp_url, status, ST_AsText(location) as location 
        FROM cctv_feeds 
        WHERE status = ${status}::text
        LIMIT ${limit} OFFSET ${offset};
      `;
    } else {
      results = await this.prisma.$queryRaw`
        SELECT id, name, rtsp_url, status, ST_AsText(location) as location 
        FROM cctv_feeds 
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    // Decrypt rtsp_url for safe consumption
    return results.map((feed) => ({
      ...feed,
      rtsp_url: feed.rtsp_url ? decrypt(feed.rtsp_url) : null,
    }));
  }

  async findOne(id: string) {
    const results: any[] = await this.prisma.$queryRaw`
      SELECT id, name, rtsp_url, status, ST_AsText(location) as location 
      FROM cctv_feeds 
      WHERE id = ${id}::uuid;
    `;
    if (!results || results.length === 0) return null;
    const feed = results[0];
    return {
      ...feed,
      rtsp_url: feed.rtsp_url ? decrypt(feed.rtsp_url) : null,
    };
  }

  async update(id: string,_updateDto: UpdateCctvDto) {
    return `CCTV feed ${id} updated`;
  }

  async remove(id: string) {
    return this.prisma.$executeRaw`DELETE FROM cctv_feeds WHERE id = ${id}::uuid;`;
  }
}

