import { SilverService } from './silver.service';
import type { IBronzeRepository } from '../bronze/repositories/bronze.repository.interface';
import type { ISilverRepository } from './repositories/silver.repository.interface';
import { BronzeRecord } from '../common/interfaces/event.interface';

describe('SilverService', () => {
  let service: SilverService;
  let mockBronzeRepository: jest.Mocked<IBronzeRepository>;
  let mockSilverRepository: jest.Mocked<ISilverRepository>;

  const validBronzeRecord: BronzeRecord = {
    transaction_id: 'tx_001',
    customer_id: 'usr_abc',
    timestamp: '2026-05-21 15:30:00 UTC',
    product: { id: 'prod_01', category: 'Electronics', price: 299.99 },
    quantity: 2,
    ingested_at: new Date('2026-05-21T15:30:00.000Z'),
  };

  beforeEach(() => {
    mockBronzeRepository = {
      save: jest.fn(),
      findAll: jest.fn().mockResolvedValue([validBronzeRecord]),
    };

    mockSilverRepository = {
      save: jest.fn().mockResolvedValue({}),
      findAll: jest.fn().mockResolvedValue([]),
      saveError: jest.fn().mockResolvedValue(undefined),
      findErrors: jest.fn().mockResolvedValue([]),
    };

    service = new SilverService(mockBronzeRepository, mockSilverRepository);
  });

  describe('process', () => {
    it('should read all records from BronzeRepository', async () => {
      await service.process();
      expect(mockBronzeRepository.findAll).toHaveBeenCalled();
    });

    it('should calculate total_amount as price × quantity', async () => {
      await service.process();

      const savedRecord = (mockSilverRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedRecord.total_amount).toBe(599.98);
    });

    it('should convert timestamp to ISO 8601 format', async () => {
      await service.process();

      const savedRecord = (mockSilverRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedRecord.timestamp).toBe('2026-05-21T15:30:00.000Z');
    });

    it('should save valid records to SilverRepository', async () => {
      await service.process();
      expect(mockSilverRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should return count of processed and error records', async () => {
      const result = await service.process();
      expect(result).toEqual({ processed: 1, errors: 0 });
    });
  });

  describe('validation — total_amount <= 0', () => {
    it('should reject a record with price 0 and send it to error_events', async () => {
      const invalidRecord: BronzeRecord = {
        ...validBronzeRecord,
        transaction_id: 'tx_bad',
        product: { ...validBronzeRecord.product, price: 0 },
      };
      mockBronzeRepository.findAll.mockResolvedValue([invalidRecord]);

      const result = await service.process();

      expect(mockSilverRepository.save).not.toHaveBeenCalled();
      expect(mockSilverRepository.saveError).toHaveBeenCalledWith(
        invalidRecord,
        'total_amount must be greater than 0',
      );
      expect(result).toEqual({ processed: 0, errors: 1 });
    });

    it('should reject a record with negative price', async () => {
      const invalidRecord: BronzeRecord = {
        ...validBronzeRecord,
        product: { ...validBronzeRecord.product, price: -10 },
      };
      mockBronzeRepository.findAll.mockResolvedValue([invalidRecord]);

      const result = await service.process();

      expect(mockSilverRepository.saveError).toHaveBeenCalled();
      expect(result.errors).toBe(1);
    });
  });

  describe('validation — mixed valid and invalid records', () => {
    it('should process valid and reject invalid records in the same batch', async () => {
      const invalidRecord: BronzeRecord = {
        ...validBronzeRecord,
        transaction_id: 'tx_bad',
        product: { ...validBronzeRecord.product, price: 0 },
      };
      mockBronzeRepository.findAll.mockResolvedValue([validBronzeRecord, invalidRecord]);

      const result = await service.process();

      expect(mockSilverRepository.save).toHaveBeenCalledTimes(1);
      expect(mockSilverRepository.saveError).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ processed: 1, errors: 1 });
    });
  });
});
