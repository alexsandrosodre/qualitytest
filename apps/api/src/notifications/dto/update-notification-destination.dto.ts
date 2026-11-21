import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * Corpo de edição de destino (contratos-api.md, seção 12).
 * O canal não é editável: a configuração é validada contra o canal original.
 */
export class UpdateNotificationDestinationDto {
  @ApiPropertyOptional({ type: Object, description: 'Nova configuração (sem segredos).' })
  @IsOptional()
  @IsObject()
  destinationConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Habilita/desabilita o envio pelo destino.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
