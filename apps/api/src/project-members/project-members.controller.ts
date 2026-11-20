import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireProjectRole } from '../common/decorators/require-project-role.decorator';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import {
  ProjectMembersService,
  type ProjectMemberListItem,
  type ProjectMemberView,
} from './project-members.service';

@ApiTags('project-members')
@ApiBearerAuth()
@Controller('projects/:projectId/members')
@UseGuards(ProjectAccessGuard)
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Post()
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Adiciona/reativa um vínculo (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiCreatedResponse({ description: 'Vínculo criado ou reativado.' })
  add(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ): Promise<ProjectMemberView> {
    return this.projectMembersService.add(actor, projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista membros do projeto (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Lista de membros do projeto.' })
  list(
    @CurrentUser() _actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ): Promise<ProjectMemberListItem[]> {
    return this.projectMembersService.list(projectId);
  }

  @Patch(':userId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Altera o papel do usuário no projeto (ADMINISTRADOR ou GESTOR).' })
  @ApiOkResponse({ description: 'Vínculo atualizado.' })
  updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberView> {
    return this.projectMembersService.updateRole(actor, projectId, userId, dto.role);
  }

  @Delete(':userId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Desativa o vínculo (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Vínculo desativado.' })
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ): Promise<ProjectMemberView> {
    return this.projectMembersService.remove(actor, projectId, userId);
  }
}
