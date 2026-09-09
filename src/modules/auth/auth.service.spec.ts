import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = {
    sign: jest.fn(() => 'mocked_jwt_token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('Test login with correct credentials -> returns tokens', async () => {
    const loginDto = { 
      email: 'test@example.com', 
      password: 'password123', 
      deviceFingerprint: 'my-device' 
    };
    
    const result = await service.login(loginDto);
    
    expect(result.accessToken).toEqual('mocked_jwt_token');
    expect(result.refreshToken).toEqual('mocked_jwt_token');
  });

  it('Test refresh with valid token -> returns new access token', async () => {
    const result = await service.refresh('old_valid_token');
    
    expect(result.accessToken).toEqual('new_access_token');
  });
});