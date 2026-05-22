import { InMemorySilverRepository } from './inmemory-silver.repository';
import { BronzeRecord, SilverRecord } from '../../common/interfaces/event.interface';

describe('InMemorySilverRepository', () => {
  let repository: InMemorySilverRepository;

  const mockBronzeRecord: BronzeRecord = {
    transaction_id: 'tx_001',
    customer_id: 'usr_abc',
    timestamp: '2026-05-21 15:30:00 UTC',
    product: { id: 'prod_01', category: 'Electronics', price: 299.99 },
    quantity: 2,
    ingested_at: new Date('2026-05-21T15:30:00.000Z'),
  };

  const mockSilverRecord: SilverRecord = {
    transaction_id: 'tx_001',
    customer_id: 'usr_abc',
    timestamp: '2026-05-21T15:30:00.000Z',
    product: { id: 'prod_01', category: 'Electronics', price: 299.99 },
    quantity: 2,
    total_amount: 599.98,
    ingested_at: new Date('2026-05-21T15:30:00.000Z'),
  };

  beforeEach(() => {
    repository = new InMemorySilverRepository();
  });

  describe('save', () => {
    it('should save a valid silver record and return it', async () => {
      const result = await repository.save(mockSilverRecord);

      expect(result.transaction_id).toBe('tx_001');
      expect(result.total_amount).toBe(599.98);
      expect(result.timestamp).toBe('2026-05-21T15:30:00.000Z');
    });
  });

  describe('findAll', () => {
    it('should return empty array when no valid records saved', async () => {
      expect(await repository.findAll()).toEqual([]);
    });

    it('should return all saved valid records', async () => {
      await repository.save(mockSilverRecord);
      await repository.save({ ...mockSilverRecord, transaction_id: 'tx_002' });

      expect(await repository.findAll()).toHaveLength(2);
    });

    it('should return a copy so external mutations do not affect stored records', async () => {
      await repository.save(mockSilverRecord);
      const records = await repository.findAll();
      records.pop();

      expect(await repository.findAll()).toHaveLength(1);
    });
  });

  describe('saveError', () => {
    it('should save an error record with the given reason', async () => {
      await repository.saveError(mockBronzeRecord, 'total_amount must be greater than 0');

      const errors = await repository.findErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe('total_amount must be greater than 0');
      expect(errors[0].original.transaction_id).toBe('tx_001');
      expect(errors[0].failed_at).toBeInstanceOf(Date);
    });
  });

  describe('findErrors', () => {
    it('should return empty array when no error records saved', async () => {
      expect(await repository.findErrors()).toEqual([]);
    });

    it('should accumulate multiple error records', async () => {
      await repository.saveError(mockBronzeRecord, 'reason A');
      await repository.saveError({ ...mockBronzeRecord, transaction_id: 'tx_002' }, 'reason B');

      expect(await repository.findErrors()).toHaveLength(2);
    });
  });

  describe('idempotency', () => {
    it('should not duplicate a record if the same transaction_id is saved twice', async () => {
      await repository.save(mockSilverRecord);
      await repository.save(mockSilverRecord);

      expect(await repository.findAll()).toHaveLength(1);
    });

    it('should save two records with different transaction_ids', async () => {
      await repository.save(mockSilverRecord);
      await repository.save({ ...mockSilverRecord, transaction_id: 'tx_002' });

      expect(await repository.findAll()).toHaveLength(2);
    });
  });
});
