import { IBronzeRepository } from './bronze.repository.interface';
import { BronzeRecord, SaleEvent } from '../../common/interfaces/event.interface';

/**
 * Implementación local del repositorio Bronze usando un array en memoria.
 * Reemplaza a BigQuery durante el desarrollo y los tests; la interfaz es idéntica,
 * por lo que cambiar a la implementación real de GCP no requiere tocar ningún servicio.
 */
export class InMemoryBronzeRepository implements IBronzeRepository {
  private readonly records: BronzeRecord[] = [];

  async save(event: SaleEvent): Promise<BronzeRecord> {
    const record: BronzeRecord = {
      ...event,
      // Deep copy del producto para que mutaciones externas no afecten el registro guardado
      product: { ...event.product },
      ingested_at: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async findAll(): Promise<BronzeRecord[]> {
    // Retorna copia del array para preservar el invariante append-only
    return [...this.records];
  }
}
