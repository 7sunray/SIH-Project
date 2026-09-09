import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { MediaModule } from './modules/media/media.module';
import { AnomaliesModule } from './modules/anomalies/anomalies.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    InspectionsModule,
    MediaModule,
    AnomaliesModule,
    AnalyticsModule,
    DatabaseModule,
    BullModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

