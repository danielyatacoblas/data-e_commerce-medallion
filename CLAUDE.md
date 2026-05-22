# CLAUDE.md — Referencia arquitectónica del proyecto

Este archivo documenta el estado final del proyecto y los patrones de
arquitectura aplicados. Úsalo como referencia en futuras conversaciones
sobre este codebase.

---

## Estado del proyecto

**COMPLETO — v1.0.0 en producción (main)**

Todas las fases implementadas con TDD estricto y GitFlow:

| Fase | Rama | Estado |
|------|------|--------|
| Bronze + POST /v1/events | feature/ingestion | mergeada ✅ |
| Silver + validación | feature/silver-layer | mergeada ✅ |
| Gold + GET /v1/metrics | feature/api-gold | mergeada ✅ |
| Python analytics + charts | feature/analytics-python | mergeada ✅ |
| Release | develop → main | tag v1.0.0 ✅ |

---

## Skill: Arquitectura Medallón en NestJS

### Principio fundamental
Cada capa es un módulo NestJS independiente con su propio Repository.
Ninguna capa accede directamente a los datos de otra — solo a través de su interfaz pública.

```
BronzeModule → IBronzeRepository → InMemoryBronzeRepository
SilverModule → ISilverRepository → InMemorySilverRepository
GoldModule   → (lee Silver vía SilverService)
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

---

## Skill: TypeScript strict en NestJS

### Configuración aplicada (tsconfig.json)
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "isolatedModules": true,
  "emitDecoratorMetadata": true
}
```

### DTO con class-validator
Todo input externo pasa por un DTO validado. Nunca usar `any` para datos de entrada:

```typescript
export class CreateEventDto implements SaleEvent {
  @IsString() @IsNotEmpty()
  transaction_id: string;

  @ValidateNested() @Type(() => ProductDto)
  product: ProductDto;

  @IsInt() @Min(1)
  quantity: number;
}
```

### ValidationPipe global (main.ts)
```typescript
app.useGlobalPipes(new ValidationPipe({
  transform: true,   // convierte tipos automáticamente
  whitelist: true,   // elimina campos no declarados en el DTO
}));
```

### Repository Pattern — por qué InMemory y no BigQuery SDK directo
- Permite testear servicios sin dependencias externas
- En producción se swapea `InMemoryBronzeRepository` por `BigQueryBronzeRepository`
  implementando la misma interfaz `IBronzeRepository` — sin tocar los servicios
- Los tests son deterministas y rápidos

---

## Skill: TDD con Jest en NestJS

### Orden estricto por archivo
1. `.spec.ts` con datos hardcodeados → commit `test(capa):`
2. Implementación mínima → commit `feat(capa):`
3. Refactor si aplica → commit `refactor:`

### Patrón de test para servicios con DI
```typescript
const mockRepo: IBronzeRepository = {
  save: jest.fn(),
  findAll: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    BronzeService,
    { provide: BRONZE_REPOSITORY, useValue: mockRepo },
  ],
}).compile();
```

### Datos de test — siempre hardcodeados en el .spec.ts
No usar factories ni librerías de generación. Los datos fijos hacen los tests
predecibles y el resultado esperado es siempre el mismo.

---

## Skill: Python Analytics

### Flujo de datos
```
gold_data.json  →  load_gold_data()  →  DataFrame
                →  calculate_ticket_promedio()  →  CSV
                →  generate_charts()  →  4 PNG
```

### Separación de funciones del bloque __main__
Todas las funciones (`load_gold_data`, `calculate_ticket_promedio`, `save_summary`,
`generate_charts`) son importables por pytest sin efectos secundarios.
El bloque `if __name__ == '__main__':` solo orquesta.

### 4 tipos de gráficas KPI implementadas
| Archivo | Tipo | Usa |
|---------|------|-----|
| `sales_by_category.png` | Donut chart | df consolidado por categoría |
| `ticket_promedio_by_category.png` | Lollipop chart | df consolidado por categoría |
| `sales_trend.png` | Línea + área | df_raw con sale_date (pivot) |
| `daily_transactions.png` | Área apilada | df_raw con sale_date (pivot) |

### matplotlib headless
`matplotlib.use('Agg')` — genera PNGs sin necesitar display. Compatible con
servidores CI, contenedores Docker y cualquier entorno sin GUI.

---

## Reglas que aplican en este repo

- Sin Co-Authored-By en commits — todos los commits son del autor
- Conventional Commits en inglés: feat, test, fix, chore, docs, refactor, merge
- GitFlow: feature/* → develop → main, siempre --no-ff
- Código en inglés, comentarios en español donde aporten contexto
- Sin mocks de BigQuery SDK — Repository Pattern InMemory es la abstracción local
- Nunca `any` explícito — TypeScript strict es obligatorio
