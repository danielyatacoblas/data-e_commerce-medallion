# Contexto de trabajo con IA — Daniel Yatacoblas

Este documento describe el contexto que definí para trabajar con Claude (Anthropic)
como asistente durante el desarrollo de este proyecto. No es código generado por IA
— es el marco que yo establecí para guiar la colaboración.

---

## Qué construí

Un pipeline de datos para una plataforma de E-Commerce siguiendo la
**Arquitectura Medallón** (Bronze → Silver → Gold), expuesto como API REST
con NestJS + TypeScript y complementado con análisis en Python/Pandas.

---

## Cómo usé la IA

Usé Claude como co-piloto técnico, no como generador automático de código.
El flujo de trabajo fue siempre:

1. **Yo definía el problema y las reglas de negocio** antes de pedirle algo a la IA
2. **La IA proponía una implementación** basada en el contexto que yo le daba
3. **Yo revisaba, cuestionaba y ajustaba** hasta que el código reflejara exactamente lo que el enunciado pedía
4. **Los tests corrían en RED primero** — si la IA generaba código que pasaba el test antes de tiempo, el test era inválido y lo reescribíamos

La IA nunca tomó decisiones de arquitectura por su cuenta. Cada decisión —
desde la jerarquía de interfaces hasta el diseño pull-based del pipeline —
fue discutida y aprobada por mí antes de implementarse.

---

## El contexto que le di a la IA

Para que la IA trabajara dentro de mis criterios, le di instrucciones explícitas
en cada sesión sobre:

### Reglas de negocio por capa

- **Bronze**: recibir el JSON exactamente como llega, agregar `ingested_at`, responder `201`
- **Silver**: calcular `total_amount = price × quantity`, convertir timestamp a ISO 8601, quarantine si `total_amount <= 0`
- **Gold**: agrupar por `category + DATE`, exponer `SUM(total_amount)` y `COUNT(*)` via GET

### Restricciones técnicas que yo impuse

- TypeScript strict obligatorio (`strict: true`, `noImplicitAny: true`) — no negociable
- Repository Pattern InMemory en lugar del SDK real de BigQuery — para mantener los tests deterministas
- TDD estricto: test RED → commit → implementación GREEN → commit — en ese orden siempre
- GitFlow con `--no-ff` en todos los merges — visible en el historial
- Conventional Commits en inglés — `feat:`, `test:`, `fix:`, `docs:`, `chore:`
- Sin `Co-Authored-By` en los commits — el trabajo es mío

### Lo que la IA no podía decidir

- Qué valida Silver y qué no (eso lo define el enunciado)
- Qué exporta cada módulo NestJS (eso lo define la arquitectura que yo diseñé)
- Qué datos van al test (siempre hardcodeados por mí, no generados)
- Si un commit era válido (yo lo ejecutaba y verificaba antes de commitear)

---

## Patrones que documenté durante el proceso

Los patrones arquitectónicos que surgieron de la colaboración con la IA
están documentados en la carpeta [`skills/`](./skills/):

| Archivo | Qué documenta |
|---------|--------------|
| [`skill_medallion_nestjs.md`](./skills/skill_medallion_nestjs.md) | Separación Bronze/Silver/Gold, pipeline pull-based, jerarquía de tipos |
| [`skill_typescript_strict.md`](./skills/skill_typescript_strict.md) | TypeScript strict, DTOs con class-validator, Repository Pattern |
| [`skill_tdd_jest.md`](./skills/skill_tdd_jest.md) | Orden RED→GREEN, mocks con inyección de dependencias, datos hardcodeados |
| [`skill_python_analytics.md`](./skills/skill_python_analytics.md) | Pandas, 4 tipos de gráficas KPI, matplotlib headless |

---

## Qué aprendí del proceso

Trabajar con IA de esta forma me permitió:

- **Iterar más rápido** en la estructura de módulos NestJS, que tiene mucho boilerplate
- **Detectar edge cases** que no había considerado, como la idempotencia del repositorio Silver cuando `process()` se llama múltiples veces
- **Documentar decisiones** en tiempo real en lugar de hacerlo al final

Lo que no delegué a la IA: el entendimiento del enunciado, las decisiones de diseño,
la validación de que cada pieza funcionara de punta a punta, y la responsabilidad
sobre el código que firmé con mi nombre en cada commit.
