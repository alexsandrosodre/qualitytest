import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { ProjectEnvironmentsController } from './project-environments.controller';
import { ProjectEnvironmentsService } from './project-environments.service';

@Module({
  imports: [AuditModule],
  controllers: [ProjectEnvironmentsController],
  providers: [ProjectEnvironmentsService, ProjectAccessGuard],
})
export class ProjectEnvironmentsModule {}
