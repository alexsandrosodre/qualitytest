import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual.' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ description: 'Nova senha (mínimo de 8 caracteres).' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @ApiPropertyOptional({
    description:
      'Refresh token da sessão atual. Quando informado, preserva esta sessão e revoga apenas as demais.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  refreshToken?: string;
}
