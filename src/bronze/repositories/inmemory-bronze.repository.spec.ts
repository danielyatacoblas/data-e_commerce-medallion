import { InMemoryBronzeRepository } from './inmemory-bronze.repository';
import { SaleEvent } from '../../common/interfaces/event.interface';

describe('InMemoryBronzeRepository', () => {
  let repository: InMemoryBronzeRepository;

  const mockEvent: SaleEvent = {
    transaction_id: 'tx_001',
    customer_id: 'usr_abc',
    timestamp: '2026-05-21 15:30:00 UTC',
    product: {
      id: 'prod_01',
      category: 'Electronics',
      price: 299.99,
    },
    quantity: 2,
  };

  beforeEach(() => {
    repository = new InMemoryBronzeRepository();
  });

  describe('save', () => {
    it('should return the event with ingested_at as a Date', async () => {
      const result = await repository.save(mockEvent);

      expect(result.transaction_id).toBe('tx_001');
      expect(result.customer_id).toBe('usr_abc');
      expect(result.product.category).toBe('Electronics');
      expect(result.ingested_at).toBeInstanceOf(Date);
    });

    it('should not mutate the original event data', async () => {
      const result = await repository.save(mockEvent);

      expect(result.timestamp).toBe('2026-05-21 15:30:00 UTC');
      expect(result.product.price).toBe(299.99);
      expect(result.quantity).toBe(2);
    });
  });

  describe('findAll', () => {
    it('should return an empty array when no events have been saved', async () => {
      const result = await repository.findAll();
      expect(result).toEqual([]);
    });

    it('should return all saved events', async () => {
      await repository.save(mockEvent);
      await repository.save({ ...mockEvent, transaction_id: 'tx_002' });

      const result = await repository.findAll();
      expect(result).toHaveLength(2);
    });

    it('should behave as append-only (each save increases count)', async () => {
      await repository.save(mockEvent);
      expect(await repository.findAll()).toHaveLength(1);

      await repository.save({ ...mockEvent, transaction_id: 'tx_002' });
      expect(await repository.findAll()).toHaveLength(2);
    });

    it('should return a copy so external mutations do not affect stored records', async () => {
      await repository.save(mockEvent);
      const first = await repository.findAll();
      first.pop();

      const second = await repository.findAll();
      expect(second).toHaveLength(1);
    });
  });
});
