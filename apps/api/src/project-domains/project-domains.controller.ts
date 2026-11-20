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
import { CreateProjectDomainMappingDto } from './dto/create-project-domain.dto';
import { UpdateProjectDomainMappingDto } from './dto/update-project-domain.dto';
import { ProjectDomainsService } from './project-domains.service';
import type { ProjectDomainMappingView } from './project-domain.mapper';

@ApiTags('project-domains')
@ApiBearerAuth()
@Controller('projects/:projectId/domains')
@UseGuards(ProjectAccessGuard)
export class ProjectDomainsController {
  constructor(private readonly domainsService: ProjectDomainsService) {}

  @Post()
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Cria um mapeamento de domínio (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiCreatedResponse({ description: 'Mapeamento criado.' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectDomainMappingDto,
  ): Promise<ProjectDomainMappingView> {
    return this.domainsService.create(actor, projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista mapeamentos de domínio (membro ativo ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Lista de mapeamentos.' })
  list(@Param('projectId') projectId: string): Promise<ProjectDomainMappingView[]> {
    return this.domainsService.list(projectId);
  }

  @Patch(':mappingId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Edita o mapeamento (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Mapeamento atualizado.' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('mappingId') mappingId: string,
    @Body() dto: UpdateProjectDomainMappingDto,
  ): Promise<ProjectDomainMappingView> {
    return this.domainsService.update(actor, projectId, mappingId, dto);
  }

  @Delete(':mappingId')
  @RequireProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Remove o mapeamento (ADMINISTRADOR ou GESTOR do projeto).' })
  @ApiOkResponse({ description: 'Mapeamento removido.' })
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('mappingId') mappingId: string,
  ): Promise<ProjectDomainMappingView> {
    return this.domainsService.remove(actor, projectId, mappingId);
  }
}
