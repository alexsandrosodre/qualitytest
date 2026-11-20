import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nome de Exemplo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({
    example: 'testador@exemplo.invalid',
    description: 'Somente administradores podem alterar o e-mail.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}
