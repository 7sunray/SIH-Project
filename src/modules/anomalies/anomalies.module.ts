import { Module } from '@nestjs/common';
import { AnomaliesController } from './anomalies.controller';
import { AnomaliesService } from './anomalies.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { WebsocketModule } from '../../websocket/websocket.module';
@Module({
  controllers: [AnomaliesController],
  providers: [AnomaliesService],
  exports: [AnomaliesService],
  imports: [DatabaseModule, AuthModule, WebsocketModule],
})
export class AnomaliesModule {}


