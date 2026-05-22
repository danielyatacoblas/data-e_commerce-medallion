import { Module } from '@nestjs/common';
import { BronzeController } from './bronze.controller';
import { BronzeService } from './bronze.service';
import { InMemoryBronzeRepository } from './repositories/inmemory-bronze.repository';
import { BRONZE_REPOSITORY } from './repositories/bronze.repository.interface';

@Module({
  controllers: [BronzeController],
  providers: [
    BronzeService,
    {
      provide: BRONZE_REPOSITORY,
      useClass: InMemoryBronzeRepository,
    },
  ],
  exports: [BRONZE_REPOSITORY],
})
export class BronzeModule {}
