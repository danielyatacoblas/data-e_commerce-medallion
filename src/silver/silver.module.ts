import { Module } from '@nestjs/common';
import { BronzeModule } from '../bronze/bronze.module';
import { SilverService } from './silver.service';
import { InMemorySilverRepository } from './repositories/inmemory-silver.repository';
import { SILVER_REPOSITORY } from './repositories/silver.repository.interface';

@Module({
  imports: [BronzeModule],
  providers: [
    SilverService,
    {
      provide: SILVER_REPOSITORY,
      useClass: InMemorySilverRepository,
    },
  ],
  exports: [SilverService, SILVER_REPOSITORY],
})
export class SilverModule {}
