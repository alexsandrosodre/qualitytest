import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Query de `GET /projects/suggest?url=<url>` (sugestão de projeto por domínio). */
export class SuggestProjectsQueryDto {
  @ApiProperty({
    example: 'https://homolog.exemplo.invalid/pedidos/123',
    description: 'URL da página em teste (usada apenas para correspondência de domínio).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;
}
