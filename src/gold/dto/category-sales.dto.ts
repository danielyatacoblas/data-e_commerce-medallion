/**
 * DTO de respuesta del endpoint GET /v1/metrics/category-sales.
 * Representa el resultado de la agregación Gold:
 * SUM(total_amount) y COUNT(*) agrupados por categoría de producto y día.
 */
export class CategorySalesDto {
  category!: string;
  sale_date!: string;         // formato YYYY-MM-DD (DATE de BigQuery)
  total_sales!: number;       // SUM(total_amount)
  transaction_count!: number; // COUNT(*)
}
