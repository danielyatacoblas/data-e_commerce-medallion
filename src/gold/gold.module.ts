import { Module } from '@nestjs/common';
import { SilverModule } from '../silver/silver.module';
import { GoldController } from './gold.controller';
import { GoldService } from './gold.service';

/**
 * Módulo Gold: capa de agregación de negocio.
 * Importa SilverModule para acceder a SilverService y SILVER_REPOSITORY,
 * ambos exportados por SilverModule.
 */
@Module({
  imports: [SilverModule],
  controllers: [GoldController],
  providers: [GoldService],
})
export class GoldModule {}
