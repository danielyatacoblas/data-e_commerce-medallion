# ecommerce-pipeline

Pipeline de datos para una plataforma de E-Commerce.
Recibe eventos de ventas via API REST y los procesa en tres capas (Bronze → Silver → Gold) siguiendo la Arquitectura Medallón. Expone métricas de negocio via GET endpoint y genera reportes analíticos con Python/Pandas.

---

## Tecnologías

- **NestJS + TypeScript** — API REST con tipado estricto
- **Jest** — testing con TDD (43 tests)
- **BigQuery** — simulado localmente con Repository Pattern
- **Python 3 + Pandas + Matplotlib** — análisis y visualización de datos
- **GCP** — arquitectura de producción escalable

---

## Cómo ejecutar localmente

### Requisitos previos

- Node.js >= 18
- Python >= 3.10
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/danielyatacoblas/data-e_commerce-medallion.git
cd data-e_commerce-medallion
```

### 2. Instalar dependencias Node.js

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

El archivo `.env.example` contiene:

```env
NODE_ENV=development
PORT=3000
GCP_PROJECT_ID=tu-proyecto-gcp
BQ_DATASET_BRONZE=bronze_raw
BQ_DATASET_SILVER=silver_cleansed
BQ_DATASET_GOLD=gold_business
PUBSUB_TOPIC=ecommerce-raw-events
```

> Para correr localmente solo necesitas `PORT=3000`. Las variables de GCP son para cuando se conecte a la infraestructura real.

### 4. Levantar el servidor

```bash
npm run start:dev
```

El servidor corre en `http://localhost:3000`

### 5. Correr los tests

```bash
npm run test
```

---

## Endpoints del Pipeline Medallón

### POST `/v1/events` — Capa Bronze

Recibe un evento de venta y lo persiste tal como llega (raw).

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

Respuesta `201`:
```json
{ "status": "received", "transaction_id": "tx_987654", "layer": "bronze" }
```

### GET `/v1/metrics/category-sales` — Capa Gold

Dispara el procesamiento Silver (limpieza + validación) y retorna las ventas agregadas por categoría y día.

```bash
curl http://localhost:3000/v1/metrics/category-sales
```

Respuesta `200`:
```json
[
  {
    "category": "Electronics",
    "sale_date": "2026-05-21",
    "total_sales": 599.98,
    "transaction_count": 2
  }
]
```

---

## Flujo del Pipeline

```
POST /v1/events
      |
      v
 [Bronze Layer]
 Guarda evento raw + agrega ingested_at
      |
      v
 [Silver Layer]  <-- se activa al llamar GET /v1/metrics
 - Convierte timestamp a ISO 8601
 - Calcula total_amount = price x quantity
 - Rechaza registros con total_amount <= 0 (error_events)
      |
      v
 [Gold Layer]
 Agrega SUM(total_sales) y COUNT(*) GROUP BY category, DATE
      |
      v
 GET /v1/metrics/category-sales
```

---

## Arquitectura Medallón (local)

![Pipeline local](diagrams/diagram_local.png)

| Capa | Qué hace |
|------|----------|
| **Bronze** | Guarda el evento JSON exactamente como llega, sin tocar nada |
| **Silver** | Limpia la fecha, calcula `total_amount = price × quantity`, rechaza montos ≤ 0 |
| **Gold** | Agrupa ventas por categoría y día (`SUM`, `COUNT`) para el negocio |

---

## Analytics Python

### Instalación

```bash
cd analytics/
pip install -r requirements.txt
```

### Ejecución

```bash
python report.py
```

El script:
1. Lee `gold_data.json` (datos exportados del endpoint Gold)
2. Calcula `ticket_promedio = total_sales / transaction_count` por categoría con Pandas
3. Guarda `summary_report.csv`
4. Genera gráficas KPI en `charts/`

### Resultado CSV

| category | total_sales | transaction_count | ticket_promedio |
|----------|------------|-------------------|-----------------|
| Clothing | 149.97 | 3 | 49.99 |
| Electronics | 1049.96 | 4 | 262.49 |
| Home & Garden | 134.97 | 3 | 44.99 |

### Dashboard KPI

**Total de ventas por categoría**

![Total de ventas por categoría](analytics/charts/sales_by_category.png)

**Ticket promedio por categoría**

![Ticket promedio por categoría](analytics/charts/ticket_promedio_by_category.png)

---

## Escalabilidad en GCP

![Arquitectura GCP](diagrams/diagram_gcp_General.png)

> Ver versión detallada: [`diagrams/diagram_gcp_Detailed.png`](diagrams/diagram_gcp_Detailed.png)

Si el volumen creciera a millones de eventos por segundo, cada capa local se reemplaza por un servicio GCP:

| Local | GCP | Por qué |
|-------|-----|---------|
| `EventsController` | **Cloud Run** | Containeriza el API, auto-escala sin configurar servidores |
| Trigger interno | **Pub/Sub** | Buffer elástico entre ingesta y procesamiento, nunca pierde eventos |
| `SilverService` | **Dataflow** | Procesa millones de registros en paralelo con Apache Beam |
| `BronzeRepository` | **BigQuery** `bronze_raw` | Almacén columnar para petabytes, append-only |
| `GoldService` | **BigQuery** vista materializada | Se actualiza sola cada hora, costo mínimo de consulta |
| — | **Cloud Storage** | Backup de eventos raw y templates de Dataflow |
| — | **Cloud Monitoring** | Alertas automáticas de latencia, errores y costos |

**Flujo en producción:**

```
E-Commerce → Cloud Run → Pub/Sub → Dataflow → BigQuery → Cloud Run (Metrics API) → Negocio
```

---

## Estructura del proyecto

```
ecommerce-pipeline/
├── src/
│   ├── bronze/        # Capa Bronze — ingesta raw
│   ├── silver/        # Capa Silver — limpieza y validación
│   ├── gold/          # Capa Gold — métricas de negocio
│   ├── common/        # Interfaces compartidas entre capas
│   └── main.ts
├── analytics/
│   ├── report.py          # Script Pandas + Matplotlib
│   ├── gold_data.json     # Datos de ejemplo exportados desde Gold
│   ├── summary_report.csv # Resultado generado
│   ├── requirements.txt   # Dependencias Python
│   └── charts/            # Gráficas KPI generadas
├── diagrams/          # Diagramas de arquitectura
├── terraform/
│   └── main.tf        # Infraestructura GCP como código
├── .env.example
└── README.md
```

---

## GitFlow

```
main     → código estable, tag v1.0.0
develop  → integración continua

feature/ingestion         → Bronze + POST /v1/events
feature/silver-layer      → Silver + validación
feature/api-gold          → Gold + GET /v1/metrics/category-sales
feature/analytics-python  → report.py + Pandas + Matplotlib
```

---

## Declaración de uso de IA

Se utilizó **Claude (Anthropic)** como asistente durante el desarrollo:

- **Diagramas** — los scripts Python y archivos PlantUML fueron generados con IA y revisados manualmente para verificar que reflejen la arquitectura real.
- **Scaffolding** — la estructura base de módulos NestJS fue sugerida por IA y adaptada a los requisitos de la prueba.
- **Validación** — cada bloque de código fue testeado localmente. El criterio de aceptación fue que los tests Jest pasaran en verde antes de hacer commit.
