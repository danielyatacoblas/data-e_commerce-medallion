---
name: skill-medallion-nestjs
description: Patrones de Arquitectura Medallón implementados en NestJS para este proyecto
metadata:
  type: project
---

## Arquitectura Medallón en NestJS — Patrones aplicados

Cada capa es un módulo NestJS independiente con su propio Repository.
Ninguna capa accede directamente a los datos de otra — solo a través de su interfaz pública.

```
BronzeModule → IBronzeRepository → InMemoryBronzeRepository
SilverModule → ISilverRepository → InMemorySilverRepository
GoldModule   → lee Silver vía SilverService
```

### Separación de responsabilidades por capa

| Capa | Qué sabe hacer | Qué NO hace |
|------|---------------|-------------|
| **Bronze** | Recibir evento raw, agregar `ingested_at`, persistir sin tocar nada | Transformar, validar negocio |
| **Silver** | Leer Bronze, calcular `total_amount`, convertir timestamp, quarantine inválidos | Agregar, exponer HTTP |
| **Gold** | Leer Silver, agrupar por category+date, exponer vía GET | Persistir raw, validar campos |

### Inyección de dependencias con interfaces

Cuando TypeScript usa `isolatedModules: true` + `emitDecoratorMetadata: true`,
los tipos de interfaz deben importarse con `import type` para que el compilador
no los borre en runtime:

```typescript
// CORRECTO — separa el token (valor) del tipo (interfaz)
import { BRONZE_REPOSITORY } from './repositories/bronze.repository.interface';
import type { IBronzeRepository } from './repositories/bronze.repository.interface';

@Injectable()
export class BronzeService {
  constructor(
    @Inject(BRONZE_REPOSITORY) private readonly repo: IBronzeRepository,
  ) {}
}
```

### Pipeline pull-based (diseño clave)

El pipeline se activa en pull, no push. Al llamar GET /v1/metrics:
1. GoldService llama `SilverService.process()`
2. SilverService lee Bronze, transforma, guarda en Silver
3. GoldService lee Silver y agrega

Esto requiere idempotencia en Silver — el repo verifica `transaction_id`
antes de insertar para evitar duplicados si `process()` se llama varias veces.

### Jerarquía de tipos compartidos

Los tipos escalan mediante herencia de interfaces, no duplicación de campos:

```typescript
SaleEvent          → evento de negocio (raw de la API)
  └─ BronzeRecord  → extiende SaleEvent + agrega ingested_at
       └─ SilverRecord → extiende BronzeRecord + agrega total_amount
GoldRecord         → tipo propio (output agregado, no hereda)
ErrorRecord        → envuelve BronzeRecord + reason + failed_at
```

**Why:** Diseño limpio que simula BigQuery con Repository Pattern intercambiable.
**How to apply:** Al agregar nuevas capas o cambiar storage, solo implementar la interfaz — los servicios no cambian.
