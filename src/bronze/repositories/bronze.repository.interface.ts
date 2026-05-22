import { BronzeRecord, SaleEvent } from '../../common/interfaces/event.interface';

export const BRONZE_REPOSITORY = 'BRONZE_REPOSITORY';

export interface IBronzeRepository {
  save(event: SaleEvent): Promise<BronzeRecord>;
  findAll(): Promise<BronzeRecord[]>;
}
