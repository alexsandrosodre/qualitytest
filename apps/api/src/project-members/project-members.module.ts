import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersService } from './project-members.service';

@Module({
  imports: [AuditModule],
  controllers: [ProjectMembersController],
  providers: [ProjectMembersService, ProjectAccessGuard],
})
export class ProjectMembersModule {}
