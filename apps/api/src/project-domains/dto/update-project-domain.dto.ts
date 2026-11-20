import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Atualização parcial do mapeamento de domínio. */
export class UpdateProjectDomainMappingDto {
  @ApiPropertyOptional({ example: 'homolog.exemplo.invalid' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  domainPattern?: string;

  @ApiPropertyOptional({ example: 'env_0001' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  environmentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
