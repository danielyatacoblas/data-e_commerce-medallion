import { Controller, Get } from '@nestjs/common';
import { GoldService } from './gold.service';
import { CategorySalesDto } from './dto/category-sales.dto';

/**
 * Expone el endpoint de métricas de negocio de la capa Gold.
 * Es el único punto de salida del pipeline hacia el consumidor final.
 */
@Controller('v1/metrics')
export class GoldController {
  constructor(private readonly goldService: GoldService) {}

  @Get('category-sales')
  async getCategorySales(): Promise<CategorySalesDto[]> {
    return this.goldService.getCategorySales();
  }
}
