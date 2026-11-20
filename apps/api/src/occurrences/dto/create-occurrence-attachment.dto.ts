import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/** Corpo de `POST /occurrences/:id/attachments` (gera URL assinada de upload). */
export class CreateOccurrenceAttachmentDto {
  @ApiProperty({ example: 'screenshot.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 204800, description: 'Tamanho em bytes.' })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  size!: number;
}
