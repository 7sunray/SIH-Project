import { Module } from '@nestjs/common';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { InspectionAssigner } from './algorithms/inspection-assigner'; // check correct relative path
import { DatabaseModule } from '../../database/database.module';
import { MediaValidator } from './validation/media-validator';
@Module({
  controllers: [InspectionsController],
  providers: [InspectionsService, InspectionAssigner,MediaValidator],
  imports: [DatabaseModule],
})
export class InspectionsModule {}

