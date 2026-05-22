import { Test, TestingModule } from '@nestjs/testing';
import { BronzeController } from './bronze.controller';
import { BronzeService, IngestResponse } from './bronze.service';
import { CreateEventDto, ProductDto } from './dto/create-event.dto';

describe('BronzeController', () => {
  let controller: BronzeController;
  let mockService: jest.Mocked<Pick<BronzeService, 'ingest'>>;

  const mockEventDto: CreateEventDto = Object.assign(new CreateEventDto(), {
    transaction_id: 'tx_001',
    customer_id: 'usr_abc',
    timestamp: '2026-05-21 15:30:00 UTC',
    product: Object.assign(new ProductDto(), {
      id: 'prod_01',
      category: 'Electronics',
      price: 299.99,
    }),
    quantity: 2,
  });

  const mockResponse: IngestResponse = {
    status: 'received',
    transaction_id: 'tx_001',
    layer: 'bronze',
  };

  beforeEach(async () => {
    mockService = {
      ingest: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BronzeController],
      providers: [
        {
          provide: BronzeService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<BronzeController>(BronzeController);
  });

  describe('POST /v1/events', () => {
    it('should call service.ingest with the received DTO', async () => {
      await controller.receiveEvent(mockEventDto);
      expect(mockService.ingest).toHaveBeenCalledWith(mockEventDto);
    });

    it('should return status "received"', async () => {
      const result = await controller.receiveEvent(mockEventDto);
      expect(result.status).toBe('received');
    });

    it('should return the transaction_id', async () => {
      const result = await controller.receiveEvent(mockEventDto);
      expect(result.transaction_id).toBe('tx_001');
    });

    it('should return layer "bronze"', async () => {
      const result = await controller.receiveEvent(mockEventDto);
      expect(result.layer).toBe('bronze');
    });
  });
});
