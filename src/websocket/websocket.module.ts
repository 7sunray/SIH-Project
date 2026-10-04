import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import * as fs from 'fs';
import * as path from 'path';

@Module({
  imports: [
    JwtModule.register({
      publicKey: fs.readFileSync(path.join(process.cwd(), 'keys', 'jwt-public.pem'), 'utf8'),
      privateKey: fs.readFileSync(path.join(process.cwd(), 'keys', 'jwt-private.pem'), 'utf8'),
      signOptions: { algorithm: 'RS256' },
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WebsocketModule {}
