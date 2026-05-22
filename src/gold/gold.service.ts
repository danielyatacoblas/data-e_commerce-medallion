import { Inject, Injectable } from '@nestjs/common';
import { SILVER_REPOSITORY } from '../silver/repositories/silver.repository.interface';
import type { ISilverRepository } from '../silver/repositories/silver.repository.interface';
import { SilverService } from '../silver/silver.service';
import { CategorySalesDto } from './dto/category-sales.dto';

/**
 * Responsabilidad única: agregar los registros Silver y exponer métricas de negocio.
 *
 * Patrón pull-based pipeline:
 *   GET /v1/metrics/category-sales
 *     → Gold dispara SilverService.process() para asegurar datos frescos
 *     → Silver lee Bronze y transforma (idempotente, sin duplicados)
 *     → Gold lee SilverRepository y agrega GROUP BY category, DATE(timestamp)
 *
 * En GCP esto sería una vista o consulta sobre la tabla BigQuery gold_business.
 */
@Injectable()
export class GoldService {
  constructor(
    private readonly silverService: SilverService,
    @Inject(SILVER_REPOSITORY) private readonly silverRepository: ISilverRepository,
  ) {}

  async getCategorySales(): Promise<CategorySalesDto[]> {
    // Garantiza que Silver tenga procesados todos los eventos Bronze recientes
    await this.silverService.process();

    const silverRecords = await this.silverRepository.findAll();

    // Agrupa en un Map con clave compuesta "category|YYYY-MM-DD"
    // equivale a: GROUP BY product.category, DATE(timestamp)
    const groups = new Map<string, CategorySalesDto>();

    for (const record of silverRecords) {
      const saleDate = record.timestamp.slice(0, 10); // extrae YYYY-MM-DD del ISO 8601
      const key = `${record.product.category}|${saleDate}`;

      const existing = groups.get(key);
      if (existing) {
        existing.total_sales = Number(
          (existing.total_sales + record.total_amount).toFixed(2),
        );
        existing.transaction_count++;
      } else {
        groups.set(key, {
          category: record.product.category,
          sale_date: saleDate,
          total_sales: record.total_amount,
          transaction_count: 1,
        });
      }
    }

    return Array.from(groups.values());
  }
}
