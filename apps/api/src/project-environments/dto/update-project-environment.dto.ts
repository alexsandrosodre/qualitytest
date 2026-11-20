import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentType, RegistrationStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Atualização parcial do ambiente. */
export class UpdateProjectEnvironmentDto {
  @ApiPropertyOptional({ example: 'Homologação' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'https://homolog.exemplo.invalid' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  baseUrl?: string;

  @ApiPropertyOptional({ enum: EnvironmentType })
  @IsOptional()
  @IsEnum(EnvironmentType)
  type?: EnvironmentType;

  @ApiPropertyOptional({ enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;
}
