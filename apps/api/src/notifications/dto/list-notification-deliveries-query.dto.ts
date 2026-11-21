import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationDeliveryStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Filtros + paginação de `GET /projects/:id/notifications/deliveries`. */
export class ListNotificationDeliveriesQueryDto {
  @ApiPropertyOptional({ enum: NotificationDeliveryStatus })
  @IsOptional()
  @IsEnum(NotificationDeliveryStatus)
  status?: NotificationDeliveryStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
