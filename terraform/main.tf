# =============================================================================
# Infraestructura GCP — Pipeline E-Commerce Medallón
# =============================================================================
# Reproduce la arquitectura del diagrama diagrams/diagram_gcp_General.png:
#
#   E-Commerce App
#       → Cloud Run (ingesta)
#       → Pub/Sub (buffer)
#       → Dataflow (ETL Bronze→Silver→Gold)
#       → BigQuery (Bronze / Silver / Gold)
#       → Cloud Run (métricas)
#       → Cloud Monitoring
#
# Uso:
#   terraform init
#   terraform plan
#   terraform apply
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

# =============================================================================
# Variables
# =============================================================================

variable "project_id" {
  description = "ID del proyecto GCP"
  type        = string
}

variable "region" {
  description = "Región GCP para todos los recursos"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Entorno de despliegue"
  type        = string
  default     = "production"
}

variable "ingestion_image" {
  description = "Imagen Docker de la API de ingesta (Cloud Run)"
  type        = string
  default     = "gcr.io/PROJECT_ID/ecommerce-ingestion:latest"
}

variable "metrics_image" {
  description = "Imagen Docker de la API de métricas (Cloud Run)"
  type        = string
  default     = "gcr.io/PROJECT_ID/ecommerce-metrics:latest"
}

# =============================================================================
# Cloud Storage — backup de eventos raw y templates de Dataflow
# =============================================================================

resource "google_storage_bucket" "pipeline_bucket" {
  name          = "${var.project_id}-ecommerce-pipeline"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    # Mueve eventos raw a almacenamiento frío después de 90 días
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = {
    environment = var.environment
    project     = "ecommerce-pipeline"
  }
}

resource "google_storage_bucket_object" "dataflow_templates_folder" {
  name    = "dataflow-templates/.keep"
  bucket  = google_storage_bucket.pipeline_bucket.name
  content = "Carpeta de templates de Dataflow"
}

resource "google_storage_bucket_object" "bronze_backup_folder" {
  name    = "bronze-backup/.keep"
  bucket  = google_storage_bucket.pipeline_bucket.name
  content = "Backup de eventos raw Bronze"
}

# =============================================================================
# Pub/Sub — bus de mensajes entre ingesta y ETL
# =============================================================================

resource "google_pubsub_topic" "ecommerce_raw_events" {
  name = "ecommerce-raw-events"

  # Retiene mensajes no consumidos hasta 7 días
  message_retention_duration = "604800s"

  labels = {
    environment = var.environment
    layer       = "ingestion"
  }
}

resource "google_pubsub_subscription" "dataflow_subscription" {
  name  = "ecommerce-raw-events-dataflow"
  topic = google_pubsub_topic.ecommerce_raw_events.name

  # Dataflow necesita al menos 10 min de ack deadline para procesar en batch
  ack_deadline_seconds = 600

  # Reintentos con backoff exponencial ante fallos de Dataflow
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # Dead-letter topic para mensajes que fallan repetidamente
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.ecommerce_dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_topic" "ecommerce_dead_letter" {
  name = "ecommerce-raw-events-dead-letter"

  labels = {
    environment = var.environment
    layer       = "error-handling"
  }
}

# =============================================================================
# BigQuery — almacén Medallón (Bronze / Silver / Gold)
# =============================================================================

resource "google_bigquery_dataset" "bronze" {
  dataset_id  = "bronze_raw"
  description = "Capa Bronze: eventos de venta exactamente como llegan, append-only"
  location    = var.region

  labels = {
    environment = var.environment
    layer       = "bronze"
  }
}

resource "google_bigquery_dataset" "silver" {
  dataset_id  = "silver_cleansed"
  description = "Capa Silver: eventos limpios con total_amount calculado y timestamp ISO 8601"
  location    = var.region

  labels = {
    environment = var.environment
    layer       = "silver"
  }
}

resource "google_bigquery_dataset" "gold" {
  dataset_id  = "gold_business"
  description = "Capa Gold: métricas de negocio agregadas por categoría y día"
  location    = var.region

  labels = {
    environment = var.environment
    layer       = "gold"
  }
}

# Tabla Bronze — eventos raw, particionada por fecha de ingesta
resource "google_bigquery_table" "bronze_events" {
  dataset_id          = google_bigquery_dataset.bronze.dataset_id
  table_id            = "events"
  deletion_protection = true

  # Partición por día de ingesta reduce costo de consulta y mejora rendimiento
  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  # Clustering por categoría acelera queries que filtran por producto
  clustering = ["product_category"]

  schema = jsonencode([
    { name = "transaction_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "customer_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "timestamp",        type = "STRING",    mode = "REQUIRED" },
    { name = "product_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "product_category", type = "STRING",    mode = "REQUIRED" },
    { name = "product_price",    type = "FLOAT64",   mode = "REQUIRED" },
    { name = "quantity",         type = "INTEGER",   mode = "REQUIRED" },
    { name = "ingested_at",      type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "raw_payload",      type = "JSON",      mode = "NULLABLE"  }
  ])

  labels = {
    environment = var.environment
    layer       = "bronze"
  }
}

# Tabla Silver — eventos transformados y validados
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
    { name = "ingested_at",      type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "processed_at",     type = "TIMESTAMP", mode = "REQUIRED" }
  ])

  labels = {
    environment = var.environment
    layer       = "silver"
  }
}

# Tabla Silver — error_events (registros rechazados con total_amount <= 0)
resource "google_bigquery_table" "silver_error_events" {
  dataset_id = google_bigquery_dataset.silver.dataset_id
  table_id   = "error_events"

  time_partitioning {
    type  = "DAY"
    field = "failed_at"
  }

  schema = jsonencode([
    { name = "transaction_id", type = "STRING",    mode = "REQUIRED" },
    { name = "reason",         type = "STRING",    mode = "REQUIRED" },
    { name = "failed_at",      type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "raw_payload",    type = "JSON",      mode = "NULLABLE"  }
  ])

  labels = {
    environment = var.environment
    layer       = "silver-errors"
  }
}

# Vista materializada Gold — agrega SUM y COUNT por categoría y día
# Se refresca automáticamente cada hora, costo mínimo de consulta
resource "google_bigquery_table" "gold_category_sales" {
  dataset_id = google_bigquery_dataset.gold.dataset_id
  table_id   = "category_sales"

  materialized_view {
    query = <<-SQL
      SELECT
        product_category          AS category,
        sale_date,
        SUM(total_amount)         AS total_sales,
        COUNT(*)                  AS transaction_count
      FROM
        `${var.project_id}.silver_cleansed.events`
      GROUP BY
        product_category,
        sale_date
    SQL

    # Refresco automático cada hora
    refresh_interval_ms = 3600000
  }

  labels = {
    environment = var.environment
    layer       = "gold"
  }
}

# =============================================================================
# Cloud Run — API de ingesta (POST /v1/events)
# =============================================================================

resource "google_cloud_run_v2_service" "ingestion_api" {
  name     = "ecommerce-ingestion-api"
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
        value = google_pubsub_topic.ecommerce_raw_events.name
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

    # Escala hasta 100 instancias en picos de tráfico
    scaling {
      min_instance_count = 1
      max_instance_count = 100
    }
  }

  labels = {
    environment = var.environment
    layer       = "ingestion"
  }
}

# Permite acceso público al endpoint de ingesta
resource "google_cloud_run_v2_service_iam_member" "ingestion_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.ingestion_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# Cloud Run — API de métricas (GET /v1/metrics/category-sales)
# =============================================================================

resource "google_cloud_run_v2_service" "metrics_api" {
  name     = "ecommerce-metrics-api"
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

  labels = {
    environment = var.environment
    layer       = "metrics"
  }
}

resource "google_cloud_run_v2_service_iam_member" "metrics_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.metrics_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# Cloud Monitoring — alertas de latencia, errores y lag de Pub/Sub
# =============================================================================

resource "google_monitoring_alert_policy" "pubsub_lag" {
  display_name = "Pub/Sub — lag de mensajes sin consumir"
  combiner     = "OR"

  conditions {
    display_name = "Mensajes sin consumir > 10,000"
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

resource "google_monitoring_alert_policy" "cloud_run_errors" {
  display_name = "Cloud Run — tasa de errores 5xx"
  combiner     = "OR"

  conditions {
    display_name = "Errores 5xx > 1% de requests"
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
# Outputs — URLs y recursos creados
# =============================================================================

output "ingestion_api_url" {
  description = "URL del endpoint de ingesta"
  value       = google_cloud_run_v2_service.ingestion_api.uri
}

output "metrics_api_url" {
  description = "URL del endpoint de métricas Gold"
  value       = google_cloud_run_v2_service.metrics_api.uri
}

output "pubsub_topic" {
  description = "Topic de Pub/Sub para eventos raw"
  value       = google_pubsub_topic.ecommerce_raw_events.id
}

output "storage_bucket" {
  description = "Bucket de Cloud Storage para backups y templates"
  value       = google_storage_bucket.pipeline_bucket.name
}

output "bigquery_gold_table" {
  description = "Vista materializada Gold con métricas de negocio"
  value       = "${var.project_id}.${google_bigquery_dataset.gold.dataset_id}.${google_bigquery_table.gold_category_sales.table_id}"
}
