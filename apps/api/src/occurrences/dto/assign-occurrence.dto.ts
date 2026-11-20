import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Corpo de `PATCH /occurrences/:id/assignee`. */
export class AssignOccurrenceDto {
  @ApiProperty({ description: 'Usuário responsável (deve ser membro ATIVO do mesmo projeto).' })
  @IsString()
  @IsNotEmpty()
  assigneeUserId!: string;
}
