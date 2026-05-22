"""
Script analítico de la capa Gold — FASE 6.

Lee gold_data.json (exportado desde GET /v1/metrics/category-sales),
calcula el ticket promedio de compra por categoría usando Pandas
y guarda el resultado en summary_report.csv.

Uso:
    python report.py

Las funciones están separadas del bloque __main__ para que pytest
pueda importarlas y testearlas sin efectos secundarios.
"""

import os
import pandas as pd


def load_gold_data(filepath: str) -> pd.DataFrame:
    """Carga el JSON de Gold en un DataFrame de Pandas."""
    return pd.read_json(filepath)


def calculate_ticket_promedio(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula el ticket promedio por categoría.

    Un registro Gold ya viene agregado por (category, sale_date), por lo que
    primero se consolida a nivel categoría (sumando todos los días) y luego
    se divide: ticket_promedio = SUM(total_sales) / SUM(transaction_count).

    Args:
        df: DataFrame con columnas category, sale_date, total_sales, transaction_count.

    Returns:
        DataFrame con columnas category, total_sales, transaction_count, ticket_promedio.
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


def save_summary(df: pd.DataFrame, filepath: str) -> None:
    """Guarda el DataFrame resultado en un archivo CSV."""
    df.to_csv(filepath, index=False)


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))

    gold_path = os.path.join(base_dir, "gold_data.json")
    output_path = os.path.join(base_dir, "summary_report.csv")

    gold_df = load_gold_data(gold_path)
    summary = calculate_ticket_promedio(gold_df)
    save_summary(summary, output_path)

    print("Reporte generado en summary_report.csv\n")
    print(summary.to_string(index=False))
