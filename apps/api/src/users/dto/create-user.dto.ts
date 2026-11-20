import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GlobalRole, RegistrationStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Nome de Exemplo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'testador@exemplo.invalid' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ description: 'Senha inicial (mínimo de 8 caracteres).' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ enum: GlobalRole, description: 'Perfil global opcional.' })
  @IsOptional()
  @IsEnum(GlobalRole)
  globalRole?: GlobalRole;

  @ApiPropertyOptional({ enum: RegistrationStatus, default: RegistrationStatus.ATIVO })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;
}
