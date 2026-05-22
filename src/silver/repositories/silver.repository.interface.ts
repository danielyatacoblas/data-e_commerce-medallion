import { BronzeRecord, ErrorRecord, SilverRecord } from '../../common/interfaces/event.interface';

export const SILVER_REPOSITORY = 'SILVER_REPOSITORY';

export interface ISilverRepository {
  save(record: SilverRecord): Promise<SilverRecord>;
  findAll(): Promise<SilverRecord[]>;
  saveError(record: BronzeRecord, reason: string): Promise<void>;
  findErrors(): Promise<ErrorRecord[]>;
}
