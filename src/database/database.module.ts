import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service'; // Adjust path to your PrismaService

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
