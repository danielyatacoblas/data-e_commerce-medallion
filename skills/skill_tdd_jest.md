---
name: skill-tdd-jest
description: Metodología TDD con Jest en NestJS — orden de commits y patrones de test aplicados
metadata:
  type: project
---

## TDD con Jest en NestJS — Patrones aplicados

### Orden estricto por feature

1. Escribir `.spec.ts` con datos hardcodeados → ejecutar (RED, debe fallar)
2. Commit: `test(capa): descripción`
3. Escribir implementación mínima → ejecutar (GREEN, tests pasan)
4. Commit: `feat(capa): descripción`
5. Refactor si aplica → commit `refactor:`
6. Nunca commitear con tests en rojo

### Patrón de módulo de test con DI

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

### Datos siempre hardcodeados en el .spec.ts

No usar factories ni librerías de generación. Los datos fijos hacen los tests
predecibles y el resultado esperado es siempre el mismo.

```typescript
const mockEvent: SaleEvent = {
  transaction_id: 'tx_test_001',
  customer_id: 'usr_test',
  timestamp: '2026-05-21 10:00:00 UTC',
  product: { id: 'prod_1', category: 'Electronics', price: 299.99 },
  quantity: 2,
};
```

**Why:** TDD es obligatorio según el enunciado. Criterio de aceptación: tests en verde antes de cada commit `feat:`.
**How to apply:** Antes de escribir cualquier implementación, escribir el test que describe el comportamiento esperado.
