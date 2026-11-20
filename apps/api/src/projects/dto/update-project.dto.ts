import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const PROJECT_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/**
 * Atualização parcial do projeto. A mudança de `status` possui endpoint próprio
 * (`PATCH /projects/:projectId/status`), por isso não é aceita aqui.
 */
export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Intranet Maricá' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 'INTRANET-MARICA' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(PROJECT_CODE_PATTERN, {
    message: 'Use apenas letras maiúsculas, números e hífen (ex.: INTRANET-MARICA).',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'Sistema de exemplo.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
