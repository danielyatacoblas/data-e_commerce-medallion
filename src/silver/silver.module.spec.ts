import { Test, TestingModule } from '@nestjs/testing';
import { SilverModule } from './silver.module';
import { SilverService } from './silver.service';
import { BRONZE_REPOSITORY } from '../bronze/repositories/bronze.repository.interface';
import { SILVER_REPOSITORY } from './repositories/silver.repository.interface';

describe('SilverModule', () => {
  let module: TestingModule;

  const mockBronzeRepository = {
    save: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockSilverRepository = {
    save: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    saveError: jest.fn(),
    findErrors: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SilverModule],
    })
      .overrideProvider(BRONZE_REPOSITORY)
      .useValue(mockBronzeRepository)
      .overrideProvider(SILVER_REPOSITORY)
      .useValue(mockSilverRepository)
      .compile();
  });

  it('should resolve SilverService from the module', () => {
    const service = module.get<SilverService>(SilverService);
    expect(service).toBeDefined();
  });

  it('should expose SILVER_REPOSITORY as an export', () => {
    const repo = module.get(SILVER_REPOSITORY);
    expect(repo).toBeDefined();
  });
});
