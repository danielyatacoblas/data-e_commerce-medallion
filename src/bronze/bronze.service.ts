import { Inject, Injectable } from '@nestjs/common';
import { BRONZE_REPOSITORY } from './repositories/bronze.repository.interface';
import type { IBronzeRepository } from './repositories/bronze.repository.interface';
import { SaleEvent } from '../common/interfaces/event.interface';

export interface IngestResponse {
  status: string;
  transaction_id: string;
  layer: string;
}

/**
 * Responsabilidad única: recibir el evento y persistirlo en Bronze sin transformarlo.
 * No contiene lógica de negocio — eso pertenece a Silver.
 */
@Injectable()
export class BronzeService {
  constructor(
    @Inject(BRONZE_REPOSITORY)
    private readonly bronzeRepository: IBronzeRepository,
  ) {}

  async ingest(event: SaleEvent): Promise<IngestResponse> {
    const record = await this.bronzeRepository.save(event);
    return {
      status: 'received',
      transaction_id: record.transaction_id,
      layer: 'bronze',
    };
  }
}
