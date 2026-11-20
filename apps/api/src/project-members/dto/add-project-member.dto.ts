import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty({ description: 'Identificador do usuário a vincular.' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
