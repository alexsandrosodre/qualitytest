import { ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceCategory, OccurrencePriority } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Campos editáveis da ocorrência (PATCH /occurrences/:id). */
export class UpdateOccurrenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @ApiPropertyOptional({ enum: OccurrenceCategory })
  @IsOptional()
  @IsEnum(OccurrenceCategory)
  categoryId?: OccurrenceCategory;

  @ApiPropertyOptional({ enum: OccurrencePriority })
  @IsOptional()
  @IsEnum(OccurrencePriority)
  priority?: OccurrencePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  environmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  pageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  pageTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  browserInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  operatingSystemInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  viewportInfo?: string;
}
