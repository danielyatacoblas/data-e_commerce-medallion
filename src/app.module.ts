import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BronzeModule } from './bronze/bronze.module';
import { SilverModule } from './silver/silver.module';

@Module({
  imports: [BronzeModule, SilverModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
