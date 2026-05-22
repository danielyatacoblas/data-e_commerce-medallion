# ecommerce-pipeline

Backend y pipeline de datos para una plataforma de E-Commerce.
Recibe eventos de ventas, los procesa en capas (Bronze → Silver → Gold) y expone métricas via API REST.

---

## Tecnologías

- **NestJS + TypeScript** — API REST
- **Jest** — testing con TDD
- **BigQuery** (simulado local con Repository Pattern)
- **Python + Pandas** — análisis de datos
- **GCP** — arquitectura de producción

---

## Cómo ejecutar localmente

**Requisitos:** Node.js ≥ 18, Python ≥ 3.10, Git

```bash
# 1. Clonar
git clone https://github.com/TU_USUARIO/ecommerce-pipeline.git
cd ecommerce-pipeline

# 2. Instalar dependencias
npm install

# 3. Variables de entorno
cp .env.example .env

# 4. Levantar servidor
npm run start:dev
# Corre en http://localhost:3000

# 5. Tests
npm run test        # unit tests
npm run test:e2e    # tests completos
```

---

## Endpoints

### POST `/v1/events` — Enviar evento de venta

```bash
curl -X POST http://localhost:3000/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "tx_987654",
    "customer_id": "usr_abc123",
    "timestamp": "2026-05-21 15:30:00 UTC",
    "product": {
      "id": "prod_55",
      "category": "Electronics",
      "price": 299.99
    },
    "quantity": 2
  }'
```

### GET `/v1/metrics/category-sales` — Ver métricas por categoría

```bash
curl http://localhost:3000/v1/metrics/category-sales
```

```json
[
  {
    "category": "Electronics",
    "sale_date": "2026-05-21",
    "total_sales": 599.98,
    "transaction_count": 1
  }
]
```

---

## Arquitectura Medallón (local)

![Pipeline local](diagrams/diagram_local.png)

Tres capas de procesamiento:

| Capa       | Qué hace                                                                |
| ---------- | ----------------------------------------------------------------------- |
| **Bronze** | Guarda el evento JSON exactamente como llega, sin tocar nada            |
| **Silver** | Limpia la fecha, calcula `total = price × quantity`, rechaza montos ≤ 0 |
| **Gold**   | Agrupa ventas por categoría y día (`SUM`, `COUNT`) para el negocio      |

---

## Escalabilidad en GCP

![Arquitectura GCP](diagrams/diagram_gcp_General.png)

> Ver versión detallada: [`diagrams/diagram_gcp_Detailed.png`](diagrams/diagram_gcp_Detailed.png)

Si el volumen creciera a millones de eventos por segundo, cada capa local se reemplaza por un servicio GCP:

| Local              | GCP                              | Por qué                                                             |
| ------------------ | -------------------------------- | ------------------------------------------------------------------- |
| `EventsController` | **Cloud Run**                    | Containeriza el API, auto-escala sin configurar servidores          |
| Trigger interno    | **Pub/Sub**                      | Buffer elástico entre ingesta y procesamiento, nunca pierde eventos |
| `SilverService`    | **Dataflow**                     | Procesa millones de registros en paralelo con Apache Beam           |
| `BronzeRepository` | **BigQuery** `bronze_raw`        | Almacén columnar para petabytes, append-only                        |
| `GoldService`      | **BigQuery** vista materializada | Se actualiza sola cada hora, costo mínimo de consulta               |
| —                  | **Cloud Storage**                | Backup de eventos raw y templates de Dataflow                       |
| —                  | **Cloud Monitoring**             | Alertas automáticas de latencia, errores y costos                   |

**Flujo en producción:**

```
E-Commerce → Cloud Run → Pub/Sub → Dataflow → BigQuery → Cloud Run (Metrics API) → Negocio
```

---

## Analytics Python

```bash
cd analytics/
pip install pandas
python3 report.py
# Genera: summary_report.csv
```

Lee los datos de la capa Gold, calcula el ticket promedio por categoría y guarda el resultado en `summary_report.csv`.

---

## Estructura del proyecto

```
ecommerce-pipeline/
├── src/
│   ├── bronze/        # Capa Bronze — ingesta raw
│   ├── silver/        # Capa Silver — limpieza y validación
│   ├── gold/          # Capa Gold — métricas de negocio
│   └── main.ts
├── test/              # Tests e2e
├── analytics/
│   ├── report.py      # Script Pandas
│   └── gold_data.json # Datos de ejemplo
├── diagrams/          # Todos los diagramas de arquitectura
├── terraform/
│   └── main.tf        # Infraestructura GCP como código
├── .env.example
└── README.md
```

---

## Declaración de uso de IA

Se utilizó **Claude (Anthropic)** como asistente durante el desarrollo:

- **Diagramas** — los scripts Python y archivos PlantUML fueron generados con IA y revisados manualmente para verificar que reflejen la arquitectura real.
- **Scaffolding** — la estructura base de módulos NestJS fue sugerida por IA y adaptada a los requisitos de la prueba.
- **Validación** — cada bloque de código fue testeado localmente. El criterio de aceptación fue que los tests Jest pasaran en verde antes de hacer commit.

---

## GitFlow — Cómo está organizado el repositorio

Este proyecto usa **GitFlow**, una forma de organizar el trabajo en Git con ramas con propósitos claros.

**Ramas principales:**

```
main     → código estable, listo para producción
develop  → integración de todo el trabajo en progreso
```

**Ramas de funcionalidad** (se crean desde develop y se fusionan de vuelta):

```
feature/ingestion         → endpoint POST /v1/events + capa Bronze
feature/silver-layer      → limpieza, validación y capa Silver
feature/api-gold          → capa Gold + endpoint GET /v1/metrics
feature/analytics-python  → script report.py con Pandas
```

**Flujo de trabajo:**

```
develop → feature/ingestion        → merge a develop
develop → feature/silver-layer     → merge a develop
develop → feature/api-gold         → merge a develop
develop → feature/analytics-python → merge a develop
develop → merge final a main       → tag v1.0.0
```

**Tipos de commits usados (Conventional Commits):**

```
feat   → nueva funcionalidad
test   → agrega o modifica tests
chore  → configuración o setup (no toca lógica)
docs   → solo documentación
fix    → corrección de bug
```
