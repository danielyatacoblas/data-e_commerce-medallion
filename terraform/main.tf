# =============================================================================
#  GCP — Pipeline E-Commerce Medallón
#  Arquitectura: Cloud Run → Pub/Sub → Dataflow → BigQuery (Bronze/Silver/Gold)
#
#  Uso:
#    terraform init
#    terraform plan  -var="project_id=mi-proyecto"
#    terraform apply -var="project_id=mi-proyecto"
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "ID del proyecto GCP"
  type        = string
}

variable "region" {
  description = "Región GCP para todos los recursos"
  type        = string
  default     = "us-central1"
}

variable "ingestion_image" {
  description = "Imagen Docker del API de ingesta (POST /v1/events)"
  type        = string
  default     = "gcr.io/PROJECT_ID/ecommerce-ingestion:latest"
}

variable "metrics_image" {
  description = "Imagen Docker del API de métricas (GET /v1/metrics)"
  type        = string
  default     = "gcr.io/PROJECT_ID/ecommerce-metrics:latest"
}

# =============================================================================
#  1. CLOUD RUN — API de ingesta
#     Recibe POST /v1/events, valida el JSON y publica en Pub/Sub.
#     Escala automáticamente de 1 a 100 instancias según el tráfico.
# =============================================================================

resource "google_cloud_run_v2_service" "ingestion" {
  name     = "ecommerce-ingestion"
  location = var.region

  template {
    containers {
      image = var.ingestion_image

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.raw_events.name
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 100
    }
  }
}

# Permite acceso público al endpoint de ingesta
resource "google_cloud_run_v2_service_iam_member" "ingestion_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.ingestion.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
#  2. PUB/SUB — Bus de mensajes entre ingesta y ETL
#     Desacopla Cloud Run de Dataflow. Garantiza que ningún evento se pierda
#     aunque Dataflow esté saturado. Soporta millones de mensajes por segundo.
# =============================================================================

resource "google_pubsub_topic" "raw_events" {
  name = "ecommerce-raw-events"

  # Retiene mensajes no consumidos hasta 7 días (replay ante fallos)
  message_retention_duration = "604800s"
}

resource "google_pubsub_topic" "dead_letter" {
  name = "ecommerce-raw-events-dead-letter"
  # Recibe mensajes que fallaron más de 5 veces en Dataflow
}

resource "google_pubsub_subscription" "dataflow" {
  name  = "ecommerce-raw-events-dataflow"
  topic = google_pubsub_topic.raw_events.name

  # Dataflow necesita tiempo para procesar cada batch
  ack_deadline_seconds = 600

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

# =============================================================================
#  3. BIGQUERY — Almacén Medallón (Bronze / Silver / Gold)
#     Tres datasets independientes, uno por capa. Las tablas están particionadas
#     por fecha para reducir el costo y la latencia de cada consulta.
# =============================================================================

# --- Datasets ---

resource "google_bigquery_dataset" "bronze" {
  dataset_id  = "bronze_raw"
  description = "Eventos de venta exactamente como llegan — append-only"
  location    = var.region
}

resource "google_bigquery_dataset" "silver" {
  dataset_id  = "silver_cleansed"
  description = "Eventos transformados: timestamp ISO 8601, total_amount calculado, inválidos descartados"
  location    = var.region
}

resource "google_bigquery_dataset" "gold" {
  dataset_id  = "gold_business"
  description = "Métricas de negocio: SUM(total_sales) y COUNT(*) agrupados por categoría y día"
  location    = var.region
}

# --- Tabla Bronze ---
# Particionada por ingested_at + clustered por categoría para queries eficientes

resource "google_bigquery_table" "bronze_events" {
  dataset_id          = google_bigquery_dataset.bronze.dataset_id
  table_id            = "events"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["product_category"]

  schema = jsonencode([
    { name = "transaction_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "customer_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "timestamp",        type = "STRING",    mode = "REQUIRED" },
    { name = "product_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "product_category", type = "STRING",    mode = "REQUIRED" },
    { name = "product_price",    type = "FLOAT64",   mode = "REQUIRED" },
    { name = "quantity",         type = "INTEGER",   mode = "REQUIRED" },
    { name = "ingested_at",      type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# --- Tabla Silver (registros válidos) ---

resource "google_bigquery_table" "silver_events" {
  dataset_id          = google_bigquery_dataset.silver.dataset_id
  table_id            = "events"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "sale_date"
  }

  clustering = ["product_category"]

  schema = jsonencode([
    { name = "transaction_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "customer_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "timestamp_iso",    type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "sale_date",        type = "DATE",      mode = "REQUIRED" },
    { name = "product_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "product_category", type = "STRING",    mode = "REQUIRED" },
    { name = "product_price",    type = "FLOAT64",   mode = "REQUIRED" },
    { name = "quantity",         type = "INTEGER",   mode = "REQUIRED" },
    { name = "total_amount",     type = "FLOAT64",   mode = "REQUIRED" },
    { name = "processed_at",     type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# --- Tabla Silver (registros rechazados — quarantine) ---

resource "google_bigquery_table" "silver_errors" {
  dataset_id = google_bigquery_dataset.silver.dataset_id
  table_id   = "error_events"

  time_partitioning {
    type  = "DAY"
    field = "failed_at"
  }

  schema = jsonencode([
    { name = "transaction_id", type = "STRING",    mode = "REQUIRED" },
    { name = "reason",         type = "STRING",    mode = "REQUIRED" },
    { name = "failed_at",      type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# --- Vista materializada Gold ---
# Agrega SUM y COUNT por categoría y día. Se refresca automáticamente cada hora.
# Consultas al endpoint GET /v1/metrics leen de aquí — costo mínimo.

resource "google_bigquery_table" "gold_category_sales" {
  dataset_id = google_bigquery_dataset.gold.dataset_id
  table_id   = "category_sales"

  materialized_view {
    query = <<-SQL
      SELECT
        product_category      AS category,
        sale_date,
        SUM(total_amount)     AS total_sales,
        COUNT(*)              AS transaction_count
      FROM
        `${var.project_id}.silver_cleansed.events`
      GROUP BY
        product_category,
        sale_date
    SQL

    refresh_interval_ms = 3600000  # refresco automático cada hora
  }
}

# =============================================================================
#  4. CLOUD RUN — API de métricas
#     Expone GET /v1/metrics/category-sales consultando la vista Gold de BigQuery.
# =============================================================================

resource "google_cloud_run_v2_service" "metrics" {
  name     = "ecommerce-metrics"
  location = var.region

  template {
    containers {
      image = var.metrics_image

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "BQ_DATASET_GOLD"
        value = google_bigquery_dataset.gold.dataset_id
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 50
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "metrics_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.metrics.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
#  5. CLOUD STORAGE — Backup y templates de Dataflow
# =============================================================================

resource "google_storage_bucket" "pipeline" {
  name          = "${var.project_id}-ecommerce-pipeline"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  # Mueve eventos raw a almacenamiento frío después de 90 días
  lifecycle_rule {
    condition { age = 90 }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

# =============================================================================
#  6. CLOUD MONITORING — Alertas de operación
# =============================================================================

# Alerta si Pub/Sub acumula más de 10.000 mensajes sin procesar
resource "google_monitoring_alert_policy" "pubsub_lag" {
  display_name = "Pub/Sub — mensajes acumulados sin procesar"
  combiner     = "OR"

  conditions {
    display_name = "Lag > 10,000 mensajes"
    condition_threshold {
      filter          = "resource.type=\"pubsub_subscription\" AND metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10000
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = []
  severity              = "WARNING"
}

# Alerta si Cloud Run registra errores 5xx
resource "google_monitoring_alert_policy" "api_errors" {
  display_name = "Cloud Run — errores 5xx en el API"
  combiner     = "OR"

  conditions {
    display_name = "Tasa de errores 5xx > 1%"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration        = "120s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.01
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = []
  severity              = "CRITICAL"
}

# =============================================================================
#  Outputs — recursos creados
# =============================================================================

output "ingestion_url" {
  description = "URL del endpoint POST /v1/events"
  value       = google_cloud_run_v2_service.ingestion.uri
}

output "metrics_url" {
  description = "URL del endpoint GET /v1/metrics/category-sales"
  value       = google_cloud_run_v2_service.metrics.uri
}

output "pubsub_topic" {
  description = "Topic Pub/Sub para eventos raw"
  value       = google_pubsub_topic.raw_events.id
}

output "storage_bucket" {
  description = "Bucket de backup y templates Dataflow"
  value       = google_storage_bucket.pipeline.name
}

output "gold_view" {
  description = "Vista materializada Gold con métricas de negocio"
  value       = "${var.project_id}.gold_business.category_sales"
}
