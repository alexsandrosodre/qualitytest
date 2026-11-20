import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Filtros + paginação de `GET /occurrences` (contratos-api.md, seção 8). */
export class ListOccurrencesQueryDto {
  @ApiProperty({ description: 'Projeto-alvo (escopo obrigatório e autorizado).' })
  @IsString()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  environmentId?: string;

  @ApiPropertyOptional({ enum: OccurrenceCategory })
  @IsOptional()
  @IsEnum(OccurrenceCategory)
  categoryId?: OccurrenceCategory;

  @ApiPropertyOptional({ enum: OccurrencePriority })
  @IsOptional()
  @IsEnum(OccurrencePriority)
  priority?: OccurrencePriority;

  @ApiPropertyOptional({ enum: OccurrenceStatus })
  @IsOptional()
  @IsEnum(OccurrenceStatus)
  status?: OccurrenceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reporterUserId?: string;

  @ApiPropertyOptional({ description: 'Data inicial (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Busca por código público, título ou descrição.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Ordenação (ex.: createdAt:desc, updatedAt:asc).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sort?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
