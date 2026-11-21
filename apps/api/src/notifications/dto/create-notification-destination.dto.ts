import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';

/**
 * Corpo de criação de destino de notificação (contratos-api.md, seção 12).
 *
 * `destinationConfig` aceita apenas as chaves da lista permitida do canal
 * (`@qualitytest/shared`); tokens e segredos são rejeitados.
 */
export class CreateNotificationDestinationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({
    type: Object,
    example: { recipientRef: '<referencia-destinatario>', template: 'occurrence_created' },
    description: 'Configuração do destino (sem segredos).',
  })
  @IsObject()
  destinationConfig!: Record<string, unknown>;

  @ApiPropertyOptional({
    default: false,
    description: 'Destinos permanecem desabilitados até serem habilitados explicitamente.',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
