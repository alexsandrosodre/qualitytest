import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Código/slug do projeto (ex.: `INTRANET-MARICA`). */
const PROJECT_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export class CreateProjectDto {
  @ApiProperty({ example: 'Intranet Maricá' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({
    example: 'INTRANET-MARICA',
    description: 'Código/slug único do projeto.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(PROJECT_CODE_PATTERN, {
    message: 'Use apenas letras maiúsculas, números e hífen (ex.: INTRANET-MARICA).',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'Sistema de exemplo.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: RegistrationStatus, default: RegistrationStatus.ATIVO })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;
}
