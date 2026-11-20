import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDomainMappingDto {
  @ApiProperty({
    example: 'homolog.exemplo.invalid',
    description: 'Domínio ou padrão de URL.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  domainPattern!: string;

  @ApiProperty({
    example: 'env_0001',
    description: 'Ambiente do MESMO projeto ao qual o domínio pertence.',
  })
  @IsString()
  @IsNotEmpty()
  environmentId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
