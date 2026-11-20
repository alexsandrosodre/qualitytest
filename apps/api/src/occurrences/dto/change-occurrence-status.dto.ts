import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Corpo de `PATCH /occurrences/:id/status` (seção 5.4). */
export class ChangeOccurrenceStatusDto {
  @ApiProperty({ enum: OccurrenceStatus })
  @IsEnum(OccurrenceStatus)
  status!: OccurrenceStatus;

  @ApiPropertyOptional({ description: 'Obrigatória em transições de reprovação/cancelamento.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string;
}
