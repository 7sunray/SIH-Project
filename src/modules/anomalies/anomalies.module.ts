import { Module } from '@nestjs/common';
import { AnomaliesController } from './anomalies.controller';
import { AnomaliesService } from './anomalies.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
@Module({
  controllers: [AnomaliesController],
  providers: [AnomaliesService, PrismaService],
  exports: [AnomaliesService],
  imports: [AuthModule],
})
export class AnomaliesModule {}


