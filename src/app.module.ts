import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BronzeModule } from './bronze/bronze.module';
import { SilverModule } from './silver/silver.module';
import { GoldModule } from './gold/gold.module';

@Module({
  imports: [BronzeModule, SilverModule, GoldModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
