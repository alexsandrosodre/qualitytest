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
import { CreateProjectEnvironmentDto } from './dto/create-project-environment.dto';
import { UpdateProjectEnvironmentDto } from './dto/update-project-environment.dto';
import { ProjectEnvironmentsService } from './project-environments.service';
import type { ProjectEnvironmentView } from './project-environment.mapper';

@ApiTags('project-environments')
@ApiBearerAuth()
@Controller('projects/:projectId/environments')
@UseGuards(ProjectAccessGuard)
export class ProjectEnvironmentsController {
  constructor(private readonly environmentsService: ProjectEnvironmentsService) {}

  @Post()
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Cria um ambiente (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiCreatedResponse({ description: 'Ambiente criado.' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectEnvironmentDto,
  ): Promise<ProjectEnvironmentView> {
    return this.environmentsService.create(actor, projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista ambientes do projeto (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Lista de ambientes.' })
  list(@Param('projectId') projectId: string): Promise<ProjectEnvironmentView[]> {
    return this.environmentsService.list(projectId);
  }

  @Get(':environmentId')
  @ApiOperation({ summary: 'Detalhe do ambiente (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Dados do ambiente.' })
  findOne(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ): Promise<ProjectEnvironmentView> {
    return this.environmentsService.findOne(projectId, environmentId);
  }

  @Patch(':environmentId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Edita o ambiente (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Ambiente atualizado.' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: UpdateProjectEnvironmentDto,
  ): Promise<ProjectEnvironmentView> {
    return this.environmentsService.update(actor, projectId, environmentId, dto);
  }

  @Delete(':environmentId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Desativa o ambiente (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Ambiente desativado.' })
  deactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ): Promise<ProjectEnvironmentView> {
    return this.environmentsService.deactivate(actor, projectId, environmentId);
  }
}
