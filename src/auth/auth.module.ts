import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import * as fs from 'fs';
import * as path from 'path';
@Global()
@Module({
  imports: [
    JwtModule.register({
      privateKey: fs.readFileSync(path.join(process.cwd(), 'keys', 'jwt-private.pem'), 'utf8'),
      publicKey: fs.readFileSync(path.join(process.cwd(), 'keys', 'jwt-public.pem'), 'utf8'),
      signOptions: { algorithm: 'RS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}

