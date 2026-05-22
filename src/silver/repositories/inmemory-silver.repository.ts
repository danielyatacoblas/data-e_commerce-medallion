import type { ISilverRepository } from './silver.repository.interface';
import {
  BronzeRecord,
  ErrorRecord,
  SilverRecord,
} from '../../common/interfaces/event.interface';

/**
 * Implementación local de SilverRepository usando arrays en memoria.
 * Mantiene dos colecciones separadas que en GCP serían tablas BigQuery distintas:
 *   - records → silver_cleansed (solo registros válidos)
 *   - errors  → silver_error_events (registros rechazados por validación)
 */
export class InMemorySilverRepository implements ISilverRepository {
  private readonly records: SilverRecord[] = [];
  private readonly errors: ErrorRecord[] = [];

  async save(record: SilverRecord): Promise<SilverRecord> {
    const stored = { ...record, product: { ...record.product } };
    this.records.push(stored);
    return stored;
  }

  async findAll(): Promise<SilverRecord[]> {
    return [...this.records];
  }

  async saveError(record: BronzeRecord, reason: string): Promise<void> {
    this.errors.push({
      original: { ...record, product: { ...record.product } },
      reason,
      failed_at: new Date(),
    });
  }

  async findErrors(): Promise<ErrorRecord[]> {
    return [...this.errors];
  }
}
