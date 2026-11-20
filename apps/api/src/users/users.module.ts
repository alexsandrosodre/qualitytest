import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { PasswordModule } from '../common/password/password.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PasswordModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
