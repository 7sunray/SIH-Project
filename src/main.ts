import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SchedulerService } from './workers/scheduler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Retrieve and execute the background job scheduler
  const schedulerService = app.get(SchedulerService);
  await schedulerService.registerCronJobs();

  await app.listen(3000);
}
bootstrap();
