/**
 * Información del producto incluida en cada evento de venta.
 */
export interface ProductInfo {
  id: string;
  category: string;
  price: number;
}

/**
 * Evento de venta tal como llega desde el cliente externo.
 * Es la unidad de entrada del pipeline — no se transforma aquí.
 */
export interface SaleEvent {
  transaction_id: string;
  customer_id: string;
  timestamp: string;
  product: ProductInfo;
  quantity: number;
}

/**
 * Capa Bronze: evento raw + metadato de ingesta.
 * Se guarda idéntico a como llegó; ingested_at lo agrega el repositorio.
 * Simula un append-only en BigQuery (sin UPDATE ni DELETE).
 */
export interface BronzeRecord extends SaleEvent {
  ingested_at: Date;
}

/**
 * Capa Silver: BronzeRecord limpio y enriquecido.
 * - timestamp se normaliza a ISO 8601
 * - total_amount se calcula como price × quantity
 * Solo llegan aquí los registros que pasaron validación.
 */
export interface SilverRecord extends BronzeRecord {
  total_amount: number;
}

/**
 * Capa Gold: resultado de la agregación de negocio.
 * SUM(total_amount) y COUNT(*) agrupados por categoría y día.
 * Es el dato que consume el equipo de negocio vía GET /v1/metrics/category-sales.
 */
export interface GoldRecord {
  category: string;
  sale_date: string;    // formato YYYY-MM-DD
  total_sales: number;
  transaction_count: number;
}

/**
 * Registro de error: guarda el BronzeRecord original que no pasó validación Silver,
 * junto con el motivo del rechazo. Equivale a una tabla de quarantine en BigQuery.
 */
export interface ErrorRecord {
  original: BronzeRecord;
  reason: string;
  failed_at: Date;
}
