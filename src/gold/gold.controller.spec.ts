import { Test, TestingModule } from '@nestjs/testing';
import { GoldController } from './gold.controller';
import { GoldService } from './gold.service';
import { CategorySalesDto } from './dto/category-sales.dto';

describe('GoldController', () => {
  let controller: GoldController;
  let mockService: jest.Mocked<Pick<GoldService, 'getCategorySales'>>;

  const mockResult: CategorySalesDto[] = [
    {
      category: 'Electronics',
      sale_date: '2026-05-21',
      total_sales: 899.97,
      transaction_count: 2,
    },
    {
      category: 'Clothing',
      sale_date: '2026-05-21',
      total_sales: 49.99,
      transaction_count: 1,
    },
  ];

  beforeEach(async () => {
    mockService = {
      getCategorySales: jest.fn().mockResolvedValue(mockResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoldController],
      providers: [{ provide: GoldService, useValue: mockService }],
    }).compile();

    controller = module.get<GoldController>(GoldController);
  });

  describe('GET /v1/metrics/category-sales', () => {
    it('should call service.getCategorySales', async () => {
      await controller.getCategorySales();
      expect(mockService.getCategorySales).toHaveBeenCalled();
    });

    it('should return the aggregated category sales array', async () => {
      const result = await controller.getCategorySales();
      expect(result).toEqual(mockResult);
    });

    it('should return empty array when there are no sales', async () => {
      mockService.getCategorySales.mockResolvedValue([]);
      const result = await controller.getCategorySales();
      expect(result).toEqual([]);
    });
  });
});
