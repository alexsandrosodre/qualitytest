import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GlobalRole, ProjectRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireGlobalRole } from '../common/decorators/require-global-role.decorator';
import { RequireProjectRole } from '../common/decorators/require-project-role.decorator';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';
import type { ProjectView } from './project.mapper';
import type { Paginated } from '@qualitytest/shared';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireGlobalRole(GlobalRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cria um projeto (somente ADMINISTRADOR).' })
  @ApiCreatedResponse({ description: 'Projeto criado.' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateProjectDto): Promise<ProjectView> {
    return this.projectsService.create(actor, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista projetos visíveis (ADMINISTRADOR vê todos; demais apenas vínculos ativos).',
  })
  @ApiOkResponse({ description: 'Lista paginada de projetos.' })
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListProjectsQueryDto,
  ): Promise<Paginated<ProjectView>> {
    return this.projectsService.findAll(actor, query);
  }

  @Get(':projectId')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Detalhe do projeto (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Dados do projeto.' })
  findOne(@Param('projectId') projectId: string): Promise<ProjectView> {
    return this.projectsService.findOne(projectId);
  }

  @Patch(':projectId')
  @UseGuards(ProjectAccessGuard)
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Edita o projeto (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Projeto atualizado.' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectView> {
    return this.projectsService.update(actor, projectId, dto);
  }

  @Patch(':projectId/status')
  @RequireGlobalRole(GlobalRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Ativa/desativa o projeto (somente ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Status do projeto atualizado.' })
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectStatusDto,
  ): Promise<ProjectView> {
    return this.projectsService.setStatus(actor, projectId, dto.status);
  }
}
