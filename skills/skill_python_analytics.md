---
name: skill-python-analytics
description: Patrones de Python analytics con Pandas y matplotlib — flujo de datos y tipos de gráficas
metadata:
  type: project
---

## Python Analytics — Patrones aplicados

### Flujo de datos

```
gold_data.json
    → load_gold_data()              → DataFrame raw (category + sale_date)
    → calculate_ticket_promedio()   → DataFrame consolidado por categoría
    → save_summary()                → summary_report.csv
    → generate_charts(df, df_raw)   → 4 PNG en charts/
```

### 4 tipos de gráficas KPI implementadas

| Archivo | Tipo | DataFrame usado |
|---------|------|-----------------|
| `sales_by_category.png` | Donut chart | df consolidado por categoría |
| `ticket_promedio_by_category.png` | Lollipop chart | df consolidado por categoría |
| `sales_trend.png` | Línea + área | df_raw pivot(sale_date × category) |
| `daily_transactions.png` | Área apilada | df_raw pivot(sale_date × category) |

### Separación de funciones del bloque __main__

Todas las funciones son importables por pytest sin efectos secundarios:

```python
def load_gold_data(filepath: str) -> pd.DataFrame: ...
def calculate_ticket_promedio(df: pd.DataFrame) -> pd.DataFrame: ...
def save_summary(df: pd.DataFrame, filepath: str) -> None: ...
def generate_charts(df, df_raw, charts_dir: str) -> None: ...

if __name__ == '__main__':
    # solo orquesta, no contiene lógica
```

### generate_events.py — poblar pipeline con 120 eventos reales

Script auxiliar que POSTea eventos al pipeline y guarda el resultado en `gold_data.json`.
BASE_URL configurable (default: `http://localhost:3000`).

### matplotlib headless

```python
import matplotlib
matplotlib.use('Agg')  # sin display, compatible con CI y contenedores
```

**Why:** Componente deseable de la prueba técnica. Python/Pandas como herramienta adecuada para análisis, separada del backend NestJS.
**How to apply:** `python report.py` ejecuta todo — CSV + 4 gráficas en una sola llamada.
