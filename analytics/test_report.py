"""
Tests para report.py usando pytest.
Verifican la lógica de cálculo sin depender del sistema de archivos.
"""
import pandas as pd
import pytest
from report import calculate_ticket_promedio, load_gold_data, save_summary


# ---------------------------------------------------------------------------
# Fixtures reutilizables
# ---------------------------------------------------------------------------

@pytest.fixture
def single_category_df():
    """DataFrame con dos registros de la misma categoría en días distintos."""
    return pd.DataFrame([
        {"category": "Electronics", "sale_date": "2026-05-21", "total_sales": 600.00, "transaction_count": 2},
        {"category": "Electronics", "sale_date": "2026-05-22", "total_sales": 300.00, "transaction_count": 1},
    ])


@pytest.fixture
def multi_category_df():
    """DataFrame con varias categorías — base para la mayoría de los tests."""
    return pd.DataFrame([
        {"category": "Electronics",  "sale_date": "2026-05-21", "total_sales": 749.97, "transaction_count": 3},
        {"category": "Electronics",  "sale_date": "2026-05-22", "total_sales": 299.99, "transaction_count": 1},
        {"category": "Clothing",     "sale_date": "2026-05-21", "total_sales": 149.97, "transaction_count": 3},
        {"category": "Home & Garden","sale_date": "2026-05-21", "total_sales":  89.98, "transaction_count": 2},
        {"category": "Home & Garden","sale_date": "2026-05-22", "total_sales":  44.99, "transaction_count": 1},
    ])


# ---------------------------------------------------------------------------
# Tests de calculate_ticket_promedio
# ---------------------------------------------------------------------------

class TestCalculateTicketPromedio:

    def test_agrega_ventas_de_misma_categoria_en_distintos_dias(self, single_category_df):
        """Cuando una categoría aparece en varios días, se suman antes de dividir."""
        result = calculate_ticket_promedio(single_category_df)

        assert len(result) == 1
        # ticket = (600 + 300) / (2 + 1) = 300.0
        assert result.iloc[0]["ticket_promedio"] == 300.0

    def test_genera_una_fila_por_categoria(self, multi_category_df):
        result = calculate_ticket_promedio(multi_category_df)
        assert len(result) == 3

    def test_columnas_requeridas_presentes(self, multi_category_df):
        result = calculate_ticket_promedio(multi_category_df)
        assert {"category", "total_sales", "transaction_count", "ticket_promedio"}.issubset(result.columns)

    def test_formula_ticket_promedio_es_total_sales_entre_transaction_count(self, multi_category_df):
        """ticket_promedio = SUM(total_sales) / SUM(transaction_count) por categoría."""
        result = calculate_ticket_promedio(multi_category_df)
        electronics = result[result["category"] == "Electronics"].iloc[0]

        expected = round((749.97 + 299.99) / (3 + 1), 2)
        assert electronics["ticket_promedio"] == expected

    def test_ticket_promedio_redondeado_a_dos_decimales(self, single_category_df):
        result = calculate_ticket_promedio(single_category_df)
        valor = result.iloc[0]["ticket_promedio"]
        assert valor == round(valor, 2)

    def test_retorna_dataframe(self, multi_category_df):
        result = calculate_ticket_promedio(multi_category_df)
        assert isinstance(result, pd.DataFrame)


# ---------------------------------------------------------------------------
# Tests de load_gold_data
# ---------------------------------------------------------------------------

class TestLoadGoldData:

    def test_carga_archivo_json_y_retorna_dataframe(self):
        df = load_gold_data("gold_data.json")
        assert isinstance(df, pd.DataFrame)

    def test_dataframe_contiene_columnas_esperadas(self):
        df = load_gold_data("gold_data.json")
        assert {"category", "sale_date", "total_sales", "transaction_count"}.issubset(df.columns)

    def test_dataframe_no_esta_vacio(self):
        df = load_gold_data("gold_data.json")
        assert len(df) > 0


# ---------------------------------------------------------------------------
# Tests de save_summary
# ---------------------------------------------------------------------------

class TestSaveSummary:

    def test_genera_archivo_csv(self, multi_category_df, tmp_path):
        summary = calculate_ticket_promedio(multi_category_df)
        output = tmp_path / "test_output.csv"
        save_summary(summary, str(output))
        assert output.exists()

    def test_csv_contiene_columna_ticket_promedio(self, multi_category_df, tmp_path):
        summary = calculate_ticket_promedio(multi_category_df)
        output = tmp_path / "test_output.csv"
        save_summary(summary, str(output))

        df_leido = pd.read_csv(str(output))
        assert "ticket_promedio" in df_leido.columns

    def test_csv_tiene_misma_cantidad_de_filas(self, multi_category_df, tmp_path):
        summary = calculate_ticket_promedio(multi_category_df)
        output = tmp_path / "test_output.csv"
        save_summary(summary, str(output))

        df_leido = pd.read_csv(str(output))
        assert len(df_leido) == len(summary)
