import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import type { Paginated } from '@qualitytest/shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireGlobalRole } from '../common/decorators/require-global-role.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import type { UserView } from './user.mapper';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequireGlobalRole(GlobalRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cria um usuário (somente ADMINISTRADOR).' })
  @ApiCreatedResponse({ description: 'Usuário criado.' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto): Promise<UserView> {
    return this.usersService.create(actor, dto);
  }

  @Get()
  @RequireGlobalRole(GlobalRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Lista usuários com paginação (somente ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Lista paginada de usuários.' })
  findAll(@Query() query: ListUsersQueryDto): Promise<Paginated<UserView>> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um usuário (o próprio ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Dados do usuário.' })
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<UserView> {
    return this.usersService.findOne(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza nome/preferências; e-mail apenas por ADMINISTRADOR.' })
  @ApiOkResponse({ description: 'Usuário atualizado.' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserView> {
    return this.usersService.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequireGlobalRole(GlobalRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Ativa/desativa um usuário (somente ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Status atualizado.' })
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserView> {
    return this.usersService.setStatus(actor, id, dto);
  }
}
