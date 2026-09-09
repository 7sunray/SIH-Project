// events.module.ts
// Kept for backwards compatibility: re-exports WebsocketModule so there is
// exactly one EventsGateway instance (previously this file provided its own
// copy with an unconfigured JwtService, which broke WS auth).
import { Module } from '@nestjs/common';
import { WebsocketModule } from './websocket.module';

@Module({
  imports: [WebsocketModule],
  exports: [WebsocketModule],
})
export class EventsModule {}
