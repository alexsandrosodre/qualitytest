import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from '../common/audit/audit.module';
import { PasswordModule } from '../common/password/password.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, PasswordModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
