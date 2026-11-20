import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de redefinição de uso único.' })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({ description: 'Nova senha (mínimo de 8 caracteres).' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
