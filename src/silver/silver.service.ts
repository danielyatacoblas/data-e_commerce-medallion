import { Inject, Injectable } from '@nestjs/common';
import { BRONZE_REPOSITORY } from '../bronze/repositories/bronze.repository.interface';
import { SILVER_REPOSITORY } from './repositories/silver.repository.interface';
import type { IBronzeRepository } from '../bronze/repositories/bronze.repository.interface';
import type { ISilverRepository } from './repositories/silver.repository.interface';
import { BronzeRecord, SilverRecord } from '../common/interfaces/event.interface';

export interface ProcessResult {
  processed: number;
  errors: number;
}

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
        transaction_id: record.transaction_id,
        customer_id: record.customer_id,
        timestamp: this.toISO8601(record.timestamp),
        product: { ...record.product },
        quantity: record.quantity,
        total_amount: Number(totalAmount.toFixed(2)),
        ingested_at: record.ingested_at,
      };

      await this.silverRepository.save(silverRecord);
      processed++;
    }

    return { processed, errors };
  }

  private toISO8601(timestamp: string): string {
    // "2026-05-21 15:30:00 UTC" → "2026-05-21T15:30:00.000Z"
    return new Date(timestamp).toISOString();
  }
}
