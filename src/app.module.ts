import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BronzeModule } from './bronze/bronze.module';

@Module({
  imports: [BronzeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
