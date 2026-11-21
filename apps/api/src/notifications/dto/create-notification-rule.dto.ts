import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationEventType, OccurrenceCategory, OccurrencePriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Filtros opcionais da regra (restringem a ocorrência que dispara a notificação). */
export class NotificationRuleFiltersDto {
  @ApiPropertyOptional({ enum: OccurrencePriority, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(OccurrencePriority, { each: true })
  priorities?: OccurrencePriority[];

  @ApiPropertyOptional({ enum: OccurrenceCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(OccurrenceCategory, { each: true })
  categories?: OccurrenceCategory[];
}

/** Corpo de criação de regra de notificação (contratos-api.md, seção 12). */
export class CreateNotificationRuleDto {
  @ApiProperty({ enum: NotificationEventType })
  @IsEnum(NotificationEventType)
  eventType!: NotificationEventType;

  @ApiProperty({ description: 'Destino do MESMO projeto que dispara a regra.' })
  @IsString()
  @IsNotEmpty()
  destinationId!: string;

  @ApiPropertyOptional({ type: NotificationRuleFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationRuleFiltersDto)
  filters?: NotificationRuleFiltersDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
