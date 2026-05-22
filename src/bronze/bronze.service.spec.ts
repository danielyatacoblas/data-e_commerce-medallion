import { BronzeService } from './bronze.service';
import { IBronzeRepository } from './repositories/bronze.repository.interface';
import { BronzeRecord, SaleEvent } from '../common/interfaces/event.interface';

describe('BronzeService', () => {
  let service: BronzeService;
  let mockRepository: jest.Mocked<IBronzeRepository>;

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

  const mockRecord: BronzeRecord = {
    ...mockEvent,
    ingested_at: new Date('2026-05-21T15:30:00.000Z'),
  };

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(mockRecord),
      findAll: jest.fn().mockResolvedValue([mockRecord]),
    };

    service = new BronzeService(mockRepository);
  });

  describe('ingest', () => {
    it('should call repository.save with the received event', async () => {
      await service.ingest(mockEvent);
      expect(mockRepository.save).toHaveBeenCalledWith(mockEvent);
    });

    it('should return status "received"', async () => {
      const result = await service.ingest(mockEvent);
      expect(result.status).toBe('received');
    });

    it('should return the transaction_id from the saved record', async () => {
      const result = await service.ingest(mockEvent);
      expect(result.transaction_id).toBe('tx_001');
    });

    it('should return layer "bronze"', async () => {
      const result = await service.ingest(mockEvent);
      expect(result.layer).toBe('bronze');
    });
  });
});
