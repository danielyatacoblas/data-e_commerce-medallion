import { GoldService } from './gold.service';
import type { ISilverRepository } from '../silver/repositories/silver.repository.interface';
import { SilverService } from '../silver/silver.service';
import { SilverRecord } from '../common/interfaces/event.interface';

describe('GoldService', () => {
  let service: GoldService;
  let mockSilverService: jest.Mocked<Pick<SilverService, 'process'>>;
  let mockSilverRepository: jest.Mocked<Pick<ISilverRepository, 'findAll'>>;

  const makeRecord = (
    id: string,
    category: string,
    date: string,
    totalAmount: number,
  ): SilverRecord => ({
    transaction_id: id,
    customer_id: 'usr_abc',
    timestamp: `${date}T15:30:00.000Z`,
    product: { id: 'prod_01', category, price: totalAmount / 2 },
    quantity: 2,
    total_amount: totalAmount,
    ingested_at: new Date(),
  });

  beforeEach(() => {
    mockSilverService = { process: jest.fn().mockResolvedValue({ processed: 1, errors: 0 }) };
    mockSilverRepository = { findAll: jest.fn() };

    service = new GoldService(
      mockSilverService as unknown as SilverService,
      mockSilverRepository as unknown as ISilverRepository,
    );
  });

  describe('getCategorySales', () => {
    it('should trigger Silver processing before reading', async () => {
      mockSilverRepository.findAll.mockResolvedValue([]);
      await service.getCategorySales();
      expect(mockSilverService.process).toHaveBeenCalled();
    });

    it('should return empty array when Silver has no records', async () => {
      mockSilverRepository.findAll.mockResolvedValue([]);
      const result = await service.getCategorySales();
      expect(result).toEqual([]);
    });

    it('should aggregate total_sales and transaction_count by category and date', async () => {
      mockSilverRepository.findAll.mockResolvedValue([
        makeRecord('tx_001', 'Electronics', '2026-05-21', 599.98),
        makeRecord('tx_002', 'Electronics', '2026-05-21', 299.99),
      ]);

      const result = await service.getCategorySales();

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Electronics');
      expect(result[0].sale_date).toBe('2026-05-21');
      expect(result[0].total_sales).toBe(899.97);
      expect(result[0].transaction_count).toBe(2);
    });

    it('should group different categories separately', async () => {
      mockSilverRepository.findAll.mockResolvedValue([
        makeRecord('tx_001', 'Electronics', '2026-05-21', 599.98),
        makeRecord('tx_002', 'Clothing', '2026-05-21', 49.99),
      ]);

      const result = await service.getCategorySales();

      expect(result).toHaveLength(2);
      const categories = result.map((r) => r.category).sort();
      expect(categories).toEqual(['Clothing', 'Electronics']);
    });

    it('should group same category on different dates separately', async () => {
      mockSilverRepository.findAll.mockResolvedValue([
        makeRecord('tx_001', 'Electronics', '2026-05-21', 599.98),
        makeRecord('tx_002', 'Electronics', '2026-05-22', 299.99),
      ]);

      const result = await service.getCategorySales();

      expect(result).toHaveLength(2);
      const dates = result.map((r) => r.sale_date).sort();
      expect(dates).toEqual(['2026-05-21', '2026-05-22']);
    });

    it('should extract sale_date as YYYY-MM-DD from ISO timestamp', async () => {
      mockSilverRepository.findAll.mockResolvedValue([
        makeRecord('tx_001', 'Electronics', '2026-05-21', 599.98),
      ]);

      const result = await service.getCategorySales();
      expect(result[0].sale_date).toBe('2026-05-21');
    });
  });
});
