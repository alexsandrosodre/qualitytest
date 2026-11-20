import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Corpo de edição de comentário. */
export class UpdateOccurrenceCommentDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
