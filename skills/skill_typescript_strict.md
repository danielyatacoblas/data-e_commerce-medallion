---
name: skill-typescript-strict
description: Patrones de TypeScript strict aplicados en NestJS — DTO, interfaces, inyección de dependencias
metadata:
  type: project
---

## TypeScript strict en NestJS — Patrones aplicados

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

**Why:** Tipado estricto es criterio de evaluación explícito en la prueba técnica.
**How to apply:** Nunca usar `any` explícito. Toda entrada externa pasa por DTO validado.
