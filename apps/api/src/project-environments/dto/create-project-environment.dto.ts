import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentType, RegistrationStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateProjectEnvironmentDto {
  @ApiProperty({ example: 'Homologação' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'https://homolog.exemplo.invalid' })
  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  baseUrl!: string;

  @ApiProperty({ enum: EnvironmentType })
  @IsEnum(EnvironmentType)
  type!: EnvironmentType;

  @ApiPropertyOptional({ enum: RegistrationStatus, default: RegistrationStatus.ATIVO })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;
}
