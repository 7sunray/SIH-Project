import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as fs from 'fs';

@Injectable()
export class AuthService {
  private readonly privateKey = fs.readFileSync('keys/jwt-private.pem', 'utf8');

  constructor(private readonly jwtService: JwtService) {}

  async login(loginDto: LoginDto) {
    const payload = { sub: 'user_id_here', email: loginDto.email, role: 'DOSJE_ADMIN' };
    
    const accessToken = this.jwtService.sign(payload, {
      privateKey: this.privateKey,
      algorithm: 'RS256',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      privateKey: this.privateKey,
      algorithm: 'RS256',
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async refresh(_refreshtoken:string) {
    return { accessToken: 'new_access_token' };
  }

  async logout(_userId:string) {
    return { success: true };
  }
}
