import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AssignOccurrenceDto } from './dto/assign-occurrence.dto';
import { ChangeOccurrenceStatusDto } from './dto/change-occurrence-status.dto';
import { CreateOccurrenceAttachmentDto } from './dto/create-occurrence-attachment.dto';
import { CreateOccurrenceCommentDto } from './dto/create-occurrence-comment.dto';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { ListOccurrencesQueryDto } from './dto/list-occurrences-query.dto';
import { UpdateOccurrenceCommentDto } from './dto/update-occurrence-comment.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import type {
  OccurrenceAttachmentView,
  OccurrenceCommentView,
  OccurrenceDetailView,
  OccurrenceHistoryView,
  OccurrenceSummaryView,
} from './occurrence.mapper';
import {
  OccurrencesService,
  type AttachmentDownloadView,
  type AttachmentUploadView,
} from './occurrences.service';
import type { Paginated } from '@qualitytest/shared';

@ApiTags('occurrences')
@ApiBearerAuth()
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly occurrencesService: OccurrencesService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Cria uma ocorrência (autor atribuído pelo servidor).' })
  @ApiCreatedResponse({ description: 'Ocorrência criada.' })
  @ApiOkResponse({ description: 'Reenvio idempotente: devolve a ocorrência já criada.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateOccurrenceDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OccurrenceDetailView> {
    const result = await this.occurrencesService.create(actor, dto, idempotencyKey);
    response.status(result.replayed ? 200 : 201);
    return result.occurrence;
  }

  @Get()
  @ApiOperation({ summary: 'Lista ocorrências do projeto autorizado (filtros + paginação).' })
  @ApiOkResponse({ description: 'Lista paginada de ocorrências.' })
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListOccurrencesQueryDto,
  ): Promise<Paginated<OccurrenceSummaryView>> {
    return this.occurrencesService.list(actor, query);
  }

  @Get(':occurrenceId')
  @ApiOperation({ summary: 'Detalhe da ocorrência (membro ativo do projeto).' })
  @ApiOkResponse({ description: 'Dados detalhados da ocorrência.' })
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
  ): Promise<OccurrenceDetailView> {
    return this.occurrencesService.findOne(actor, occurrenceId);
  }

  @Patch(':occurrenceId')
  @ApiOperation({ summary: 'Edita campos permitidos da ocorrência.' })
  @ApiOkResponse({ description: 'Ocorrência atualizada.' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Body() dto: UpdateOccurrenceDto,
  ): Promise<OccurrenceDetailView> {
    return this.occurrencesService.update(actor, occurrenceId, dto);
  }

  @Patch(':occurrenceId/assignee')
  @ApiOperation({ summary: 'Atribui/reatribui o responsável (GESTOR/ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Responsável atualizado.' })
  assign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Body() dto: AssignOccurrenceDto,
  ): Promise<OccurrenceDetailView> {
    return this.occurrencesService.assign(actor, occurrenceId, dto);
  }

  @Patch(':occurrenceId/status')
  @ApiOperation({ summary: 'Altera o status respeitando o fluxo de transições permitidas.' })
  @ApiOkResponse({ description: 'Status atualizado.' })
  changeStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Body() dto: ChangeOccurrenceStatusDto,
  ): Promise<OccurrenceDetailView> {
    return this.occurrencesService.changeStatus(actor, occurrenceId, dto);
  }

  @Get(':occurrenceId/history')
  @ApiOperation({ summary: 'Histórico cronológico de alterações da ocorrência.' })
  @ApiOkResponse({ description: 'Histórico da ocorrência.' })
  history(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
  ): Promise<OccurrenceHistoryView[]> {
    return this.occurrencesService.listHistory(actor, occurrenceId);
  }

  /* ------------------------------- Comentários ------------------------------ */

  @Get(':occurrenceId/comments')
  @ApiOperation({ summary: 'Lista comentários da ocorrência.' })
  @ApiOkResponse({ description: 'Comentários da ocorrência.' })
  listComments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
  ): Promise<OccurrenceCommentView[]> {
    return this.occurrencesService.listComments(actor, occurrenceId);
  }

  @Post(':occurrenceId/comments')
  @ApiOperation({ summary: 'Adiciona comentário à ocorrência.' })
  @ApiCreatedResponse({ description: 'Comentário adicionado.' })
  addComment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Body() dto: CreateOccurrenceCommentDto,
  ): Promise<OccurrenceCommentView> {
    return this.occurrencesService.addComment(actor, occurrenceId, dto);
  }

  @Patch(':occurrenceId/comments/:commentId')
  @ApiOperation({ summary: 'Edita comentário (autor, GESTOR ou ADMINISTRADOR).' })
  @ApiOkResponse({ description: 'Comentário atualizado.' })
  updateComment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateOccurrenceCommentDto,
  ): Promise<OccurrenceCommentView> {
    return this.occurrencesService.updateComment(actor, occurrenceId, commentId, dto);
  }

  @Delete(':occurrenceId/comments/:commentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove comentário (autor, GESTOR ou ADMINISTRADOR).' })
  @ApiNoContentResponse({ description: 'Comentário removido.' })
  deleteComment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.occurrencesService.deleteComment(actor, occurrenceId, commentId);
  }

  /* --------------------------------- Anexos --------------------------------- */

  @Get(':occurrenceId/attachments')
  @ApiOperation({ summary: 'Lista anexos da ocorrência.' })
  @ApiOkResponse({ description: 'Anexos da ocorrência.' })
  listAttachments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
  ): Promise<OccurrenceAttachmentView[]> {
    return this.occurrencesService.listAttachments(actor, occurrenceId);
  }

  @Post(':occurrenceId/attachments')
  @ApiOperation({ summary: 'Solicita upload de anexo (gera URL assinada com expiração).' })
  @ApiCreatedResponse({ description: 'Anexo registrado e URL de upload gerada.' })
  createAttachment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Body() dto: CreateOccurrenceAttachmentDto,
  ): Promise<AttachmentUploadView> {
    return this.occurrencesService.createAttachment(actor, occurrenceId, dto);
  }

  @Get(':occurrenceId/attachments/:attachmentId/url')
  @ApiOperation({ summary: 'Gera URL assinada de download do anexo.' })
  @ApiOkResponse({ description: 'URL de download gerada.' })
  downloadUrl(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<AttachmentDownloadView> {
    return this.occurrencesService.getAttachmentDownloadUrl(actor, occurrenceId, attachmentId);
  }

  @Delete(':occurrenceId/attachments/:attachmentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove anexo (autor, GESTOR ou ADMINISTRADOR).' })
  @ApiNoContentResponse({ description: 'Anexo removido.' })
  deleteAttachment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('occurrenceId') occurrenceId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    return this.occurrencesService.deleteAttachment(actor, occurrenceId, attachmentId);
  }
}
