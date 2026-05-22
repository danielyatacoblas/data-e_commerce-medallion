import { BronzeRecord, ErrorRecord, SilverRecord } from '../../common/interfaces/event.interface';

/**
 * Token de inyección para ISilverRepository.
 * Mismo patrón que Bronze: desacopla la implementación concreta del servicio.
 */
export const SILVER_REPOSITORY = 'SILVER_REPOSITORY';

/**
 * Contrato de la capa Silver.
 * Extiende el concepto append-only con una tabla de errores separada:
 * - save/findAll → registros válidos (equivale a la tabla silver_cleansed en BigQuery)
 * - saveError/findErrors → registros rechazados (equivale a una tabla de quarantine)
 */
export interface ISilverRepository {
  save(record: SilverRecord): Promise<SilverRecord>;
  findAll(): Promise<SilverRecord[]>;
  saveError(record: BronzeRecord, reason: string): Promise<void>;
  findErrors(): Promise<ErrorRecord[]>;
}
