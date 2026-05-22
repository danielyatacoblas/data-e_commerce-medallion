import { Inject, Injectable } from '@nestjs/common';
import { BRONZE_REPOSITORY } from '../bronze/repositories/bronze.repository.interface';
import { SILVER_REPOSITORY } from './repositories/silver.repository.interface';
import type { IBronzeRepository } from '../bronze/repositories/bronze.repository.interface';
import type { ISilverRepository } from './repositories/silver.repository.interface';
import { SilverRecord } from '../common/interfaces/event.interface';

export interface ProcessResult {
  processed: number;
  errors: number;
}

/**
 * Responsabilidad única: transformar y validar los registros Bronze → Silver.
 * Este servicio no expone un endpoint propio; es invocado por GoldService
 * (o por un job batch) para preparar los datos antes de la agregación.
 *
 * Nota de diseño: process() hace un reprocess completo de todos los registros Bronze.
 * En producción con BigQuery esto sería una consulta incremental (WHERE processed = false),
 * pero para el MVP local la simplicidad prima sobre la optimización.
 */
@Injectable()
export class SilverService {
  constructor(
    @Inject(BRONZE_REPOSITORY) private readonly bronzeRepository: IBronzeRepository,
    @Inject(SILVER_REPOSITORY) private readonly silverRepository: ISilverRepository,
  ) {}

  async process(): Promise<ProcessResult> {
    const bronzeRecords = await this.bronzeRepository.findAll();
    let processed = 0;
    let errors = 0;

    for (const record of bronzeRecords) {
      const totalAmount = record.product.price * record.quantity;

      if (totalAmount <= 0) {
        await this.silverRepository.saveError(record, 'total_amount must be greater than 0');
        errors++;
        continue;
      }

      const silverRecord: SilverRecord = {
        ...record,
        timestamp: this.toISO8601(record.timestamp),
        product: { ...record.product },
        // toFixed(2) previene errores de punto flotante (ej: 0.1 + 0.2 = 0.30000000000000004)
        total_amount: Number(totalAmount.toFixed(2)),
      };

      await this.silverRepository.save(silverRecord);
      processed++;
    }

    return { processed, errors };
  }

  private toISO8601(timestamp: string): string {
    // Estandariza "2026-05-21 15:30:00 UTC" al formato "2026-05-21T15:30:00.000Z"
    return new Date(timestamp).toISOString();
  }
}
