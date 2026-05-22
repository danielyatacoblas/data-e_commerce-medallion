import { BronzeRecord, SaleEvent } from '../../common/interfaces/event.interface';

/**
 * Token de inyección para IBronzeRepository.
 * Usar un string token en lugar de la clase concreta permite que NestJS
 * inyecte cualquier implementación (InMemory local o BigQuery en GCP)
 * sin cambiar el servicio ni los tests.
 */
export const BRONZE_REPOSITORY = 'BRONZE_REPOSITORY';

/**
 * Contrato de la capa Bronze.
 * La interfaz refleja lo que sería una tabla append-only en BigQuery:
 * solo se puede insertar (save) o leer todo (findAll), nunca modificar.
 */
export interface IBronzeRepository {
  save(event: SaleEvent): Promise<BronzeRecord>;
  findAll(): Promise<BronzeRecord[]>;
}
