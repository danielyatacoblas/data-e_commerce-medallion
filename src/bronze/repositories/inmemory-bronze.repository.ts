import { IBronzeRepository } from './bronze.repository.interface';
import { BronzeRecord, SaleEvent } from '../../common/interfaces/event.interface';

export class InMemoryBronzeRepository implements IBronzeRepository {
  private readonly records: BronzeRecord[] = [];

  async save(event: SaleEvent): Promise<BronzeRecord> {
    const record: BronzeRecord = {
      ...event,
      product: { ...event.product },
      ingested_at: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async findAll(): Promise<BronzeRecord[]> {
    return [...this.records];
  }
}
