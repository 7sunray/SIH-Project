import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly privateKey: string;

  constructor(private readonly jwtService: JwtService) {
    const keyPath = path.join(process.cwd(), 'keys', 'jwt-private.pem');
    this.privateKey = fs.readFileSync(keyPath, 'utf8');
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.userId, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, {
        privateKey: this.privateKey,
        algorithm: 'RS256',
      }),
    };
  }
}
