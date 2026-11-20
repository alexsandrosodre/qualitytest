import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceCategory, OccurrencePriority } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

/**
 * Corpo de criação de ocorrência (contratos-api.md, seção 8.1).
 *
 * `reporterUserId`/`userId` NÃO são aceitos: a autoria é atribuída pelo
 * servidor a partir da sessão autenticada. Como o `ValidationPipe` roda com
 * `forbidNonWhitelisted`, enviar esses campos resulta em 400.
 */
export class CreateOccurrenceDto {
  @ApiProperty({ description: 'Projeto-alvo (validado contra o vínculo do usuário).' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Ambiente do projeto (opcional).' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  environmentId?: string;

  @ApiProperty({ example: 'Componente desalinhado na página de cadastro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @ApiProperty({ enum: OccurrenceCategory })
  @IsEnum(OccurrenceCategory)
  categoryId!: OccurrenceCategory;

  @ApiProperty({ enum: OccurrencePriority })
  @IsEnum(OccurrencePriority)
  priority!: OccurrencePriority;

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

  @ApiPropertyOptional({
    description: 'Identificadores de anexos. A vinculação efetiva ocorre via endpoint de anexos.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  attachmentIds?: string[];
}
