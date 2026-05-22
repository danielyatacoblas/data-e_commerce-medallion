"""
Script analítico de la capa Gold — Pipeline E-Commerce Medallón.

Lee gold_data.json (exportado desde GET /v1/metrics/category-sales),
calcula el ticket promedio de compra por categoría usando Pandas,
genera gráficas KPI con matplotlib y guarda los resultados en:
  - summary_report.csv
  - charts/sales_by_category.png
  - charts/ticket_promedio_by_category.png

Uso:
    pip install -r requirements.txt
    python report.py

Las funciones están separadas del bloque __main__ para que pytest
pueda importarlas y testearlas sin efectos secundarios.
"""

import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # backend sin pantalla, compatible con cualquier entorno
import matplotlib.pyplot as plt


# ---------------------------------------------------------------------------
# Carga de datos
# ---------------------------------------------------------------------------

def load_gold_data(filepath: str) -> pd.DataFrame:
    """Carga el JSON de Gold en un DataFrame de Pandas."""
    return pd.read_json(filepath)


# ---------------------------------------------------------------------------
# Transformación
# ---------------------------------------------------------------------------

def calculate_ticket_promedio(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula el ticket promedio por categoría.

    Un registro Gold ya viene agregado por (category, sale_date), por lo que
    primero se consolida a nivel categoría (sumando todos los días) y luego
    se divide: ticket_promedio = SUM(total_sales) / SUM(transaction_count).
    """
    consolidado = (
        df.groupby("category", as_index=False)
        .agg(
            total_sales=("total_sales", "sum"),
            transaction_count=("transaction_count", "sum"),
        )
    )
    consolidado["ticket_promedio"] = (
        consolidado["total_sales"] / consolidado["transaction_count"]
    ).round(2)

    return consolidado


# ---------------------------------------------------------------------------
# Exportación CSV
# ---------------------------------------------------------------------------

def save_summary(df: pd.DataFrame, filepath: str) -> None:
    """Guarda el DataFrame resultado en un archivo CSV."""
    df.to_csv(filepath, index=False)


# ---------------------------------------------------------------------------
# Generación de gráficas KPI
# ---------------------------------------------------------------------------

def generate_charts(df: pd.DataFrame, charts_dir: str) -> None:
    """
    Genera dos gráficas de barras horizontales y las exporta como PNG:
      1. Total de ventas por categoría
      2. Ticket promedio por categoría
    """
    os.makedirs(charts_dir, exist_ok=True)

    colores = ["#4F81BD", "#C0504D", "#9BBB59"]

    # --- Gráfica 1: Total de ventas por categoría ---
    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.barh(df["category"], df["total_sales"], color=colores[:len(df)])
    ax.bar_label(bars, labels=[f"${v:,.2f}" for v in df["total_sales"]], padding=5)
    ax.set_xlabel("Total de ventas (USD)")
    ax.set_title("Total de ventas por categoría")
    ax.set_xlim(0, df["total_sales"].max() * 1.25)
    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, "sales_by_category.png"), dpi=120)
    plt.close()

    # --- Gráfica 2: Ticket promedio por categoría ---
    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.barh(df["category"], df["ticket_promedio"], color=colores[:len(df)])
    ax.bar_label(bars, labels=[f"${v:,.2f}" for v in df["ticket_promedio"]], padding=5)
    ax.set_xlabel("Ticket promedio (USD)")
    ax.set_title("Ticket promedio de compra por categoría")
    ax.set_xlim(0, df["ticket_promedio"].max() * 1.25)
    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, "ticket_promedio_by_category.png"), dpi=120)
    plt.close()


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))

    gold_path   = os.path.join(base_dir, "gold_data.json")
    output_path = os.path.join(base_dir, "summary_report.csv")
    charts_dir  = os.path.join(base_dir, "charts")

    gold_df = load_gold_data(gold_path)
    summary = calculate_ticket_promedio(gold_df)

    save_summary(summary, output_path)
    generate_charts(summary, charts_dir)

    print("Archivos generados:")
    print(f"  CSV : {output_path}")
    print(f"  PNG : {charts_dir}/sales_by_category.png")
    print(f"  PNG : {charts_dir}/ticket_promedio_by_category.png")
    print()
    print(summary.to_string(index=False))
