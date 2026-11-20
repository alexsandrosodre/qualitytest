import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Corpo de criação/edição de comentário. */
export class CreateOccurrenceCommentDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
