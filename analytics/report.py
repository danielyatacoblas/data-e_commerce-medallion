"""
Script analítico de la capa Gold — Pipeline E-Commerce Medallón.

Lee gold_data.json (exportado desde GET /v1/metrics/category-sales),
calcula métricas con Pandas y genera 4 gráficas KPI con matplotlib:

  1. sales_by_category.png      — Donut chart: distribución de ventas
  2. ticket_promedio_by_category.png — Lollipop: ticket promedio por categoría
  3. sales_trend.png            — Línea + área: tendencia diaria de ventas
  4. daily_transactions.png     — Área apilada: transacciones diarias

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
import matplotlib.ticker as mticker

# Paleta de colores por categoría — consistente en todas las gráficas
COLORES = {
    'Electronics':   '#2196F3',
    'Clothing':      '#E91E63',
    'Home & Garden': '#4CAF50',
    'Sports':        '#FF9800',
    'Books':         '#9C27B0',
}
COLOR_DEFAULT = '#607D8B'


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
    Consolida por categoría (suma todos los días) y calcula:
    ticket_promedio = SUM(total_sales) / SUM(transaction_count)
    """
    consolidado = (
        df.groupby('category', as_index=False)
        .agg(
            total_sales=('total_sales', 'sum'),
            transaction_count=('transaction_count', 'sum'),
        )
    )
    consolidado['ticket_promedio'] = (
        consolidado['total_sales'] / consolidado['transaction_count']
    ).round(2)
    return consolidado


# ---------------------------------------------------------------------------
# Exportación CSV
# ---------------------------------------------------------------------------

def save_summary(df: pd.DataFrame, filepath: str) -> None:
    """Guarda el DataFrame resultado en un archivo CSV."""
    df.to_csv(filepath, index=False)


# ---------------------------------------------------------------------------
# Utilidades de estilo
# ---------------------------------------------------------------------------

def _aplicar_estilo(ax):
    """Aplica estilo limpio y moderno a cualquier eje."""
    ax.set_facecolor('#F8F9FA')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#CCCCCC')
    ax.spines['bottom'].set_color('#CCCCCC')
    ax.tick_params(colors='#555555')
    ax.yaxis.label.set_color('#555555')
    ax.xaxis.label.set_color('#555555')
    ax.title.set_color('#222222')


# ---------------------------------------------------------------------------
# Generación de gráficas KPI
# ---------------------------------------------------------------------------

def generate_charts(df: pd.DataFrame, df_raw: pd.DataFrame, charts_dir: str) -> None:
    """
    Genera 4 gráficas KPI con tipos de visualización distintos:

    df      — datos consolidados por categoría (resultado de calculate_ticket_promedio)
    df_raw  — datos por categoría+fecha (directamente del gold_data.json)
    """
    os.makedirs(charts_dir, exist_ok=True)
    plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 11})

    colores = [COLORES.get(c, COLOR_DEFAULT) for c in df['category']]

    # -------------------------------------------------------------------
    # Gráfica 1 — Donut chart: distribución de ventas totales por categoría
    # -------------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(8, 6))
    fig.patch.set_facecolor('white')

    wedges, _, autotexts = ax.pie(
        df['total_sales'],
        labels=None,
        autopct='%1.1f%%',
        colors=colores,
        startangle=90,
        pctdistance=0.78,
        wedgeprops=dict(width=0.52, edgecolor='white', linewidth=2.5),
    )
    for at in autotexts:
        at.set_fontsize(10)
        at.set_fontweight('bold')
        at.set_color('white')

    # Total en el centro del donut
    total = df['total_sales'].sum()
    ax.text(0, 0, f'${total:,.0f}\nTotal', ha='center', va='center',
            fontsize=13, fontweight='bold', color='#333333')

    ax.legend(
        wedges, df['category'],
        loc='lower center', bbox_to_anchor=(0.5, -0.08),
        ncol=len(df), frameon=False, fontsize=10,
    )
    ax.set_title('Distribución de ventas por categoría', fontsize=14,
                 fontweight='bold', pad=20, color='#222222')

    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, 'sales_by_category.png'),
                dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()

    # -------------------------------------------------------------------
    # Gráfica 2 — Lollipop: ticket promedio por categoría
    # -------------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#F8F9FA')

    df_sorted = df.sort_values('ticket_promedio').reset_index(drop=True)
    colores_sorted = [COLORES.get(c, COLOR_DEFAULT) for c in df_sorted['category']]

    # Líneas horizontales (tallo del lollipop)
    ax.hlines(
        y=range(len(df_sorted)),
        xmin=0,
        xmax=df_sorted['ticket_promedio'],
        colors='#CCCCCC', linewidth=2, zorder=1,
    )
    # Círculos (cabeza del lollipop)
    ax.scatter(
        df_sorted['ticket_promedio'],
        range(len(df_sorted)),
        color=colores_sorted, s=200, zorder=3, edgecolors='white', linewidths=1.5,
    )
    # Etiquetas de valor
    for i, val in enumerate(df_sorted['ticket_promedio']):
        ax.text(val + df_sorted['ticket_promedio'].max() * 0.02, i,
                f'${val:,.2f}', va='center', fontsize=10, color='#333333')

    ax.set_yticks(range(len(df_sorted)))
    ax.set_yticklabels(df_sorted['category'], fontsize=11)
    ax.set_xlabel('Ticket promedio (USD)', fontsize=11)
    ax.set_title('Ticket promedio de compra por categoría', fontsize=14,
                 fontweight='bold', color='#222222')
    ax.set_xlim(0, df_sorted['ticket_promedio'].max() * 1.22)
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f'${x:,.0f}'))
    _aplicar_estilo(ax)

    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, 'ticket_promedio_by_category.png'),
                dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()

    # -------------------------------------------------------------------
    # Gráfica 3 — Línea + área: tendencia diaria de ventas por categoría
    # -------------------------------------------------------------------
    df_raw = df_raw.copy()
    df_raw['sale_date'] = pd.to_datetime(df_raw['sale_date'])
    pivot_ventas = (
        df_raw.pivot_table(index='sale_date', columns='category',
                           values='total_sales', aggfunc='sum')
        .fillna(0)
        .sort_index()
    )

    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#F8F9FA')

    for cat in pivot_ventas.columns:
        color = COLORES.get(cat, COLOR_DEFAULT)
        ax.plot(pivot_ventas.index, pivot_ventas[cat],
                marker='o', markersize=4, linewidth=2.2,
                label=cat, color=color, zorder=3)
        ax.fill_between(pivot_ventas.index, pivot_ventas[cat],
                        alpha=0.12, color=color)

    ax.set_xlabel('Fecha', fontsize=11)
    ax.set_ylabel('Ventas (USD)', fontsize=11)
    ax.set_title('Tendencia de ventas diarias por categoría', fontsize=14,
                 fontweight='bold', color='#222222')
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f'${x:,.0f}'))
    ax.legend(loc='upper left', framealpha=0.9, fontsize=10)
    plt.xticks(rotation=45, ha='right')
    _aplicar_estilo(ax)

    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, 'sales_trend.png'),
                dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()

    # -------------------------------------------------------------------
    # Gráfica 4 — Área apilada: transacciones diarias por categoría
    # -------------------------------------------------------------------
    pivot_tx = (
        df_raw.pivot_table(index='sale_date', columns='category',
                           values='transaction_count', aggfunc='sum')
        .fillna(0)
        .sort_index()
    )

    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#F8F9FA')

    colores_stack = [COLORES.get(c, COLOR_DEFAULT) for c in pivot_tx.columns]
    ax.stackplot(
        pivot_tx.index,
        pivot_tx.T.values,
        labels=pivot_tx.columns,
        colors=colores_stack,
        alpha=0.85,
    )

    ax.set_xlabel('Fecha', fontsize=11)
    ax.set_ylabel('Número de transacciones', fontsize=11)
    ax.set_title('Transacciones diarias por categoría (área apilada)', fontsize=14,
                 fontweight='bold', color='#222222')
    ax.legend(loc='upper left', framealpha=0.9, fontsize=10)
    plt.xticks(rotation=45, ha='right')
    _aplicar_estilo(ax)

    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, 'daily_transactions.png'),
                dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))

    gold_path   = os.path.join(base_dir, 'gold_data.json')
    output_path = os.path.join(base_dir, 'summary_report.csv')
    charts_dir  = os.path.join(base_dir, 'charts')

    gold_df  = load_gold_data(gold_path)
    summary  = calculate_ticket_promedio(gold_df)

    save_summary(summary, output_path)
    generate_charts(summary, gold_df, charts_dir)

    print('Archivos generados:')
    print(f'  CSV  : {output_path}')
    print(f'  PNG  : {charts_dir}/sales_by_category.png')
    print(f'  PNG  : {charts_dir}/ticket_promedio_by_category.png')
    print(f'  PNG  : {charts_dir}/sales_trend.png')
    print(f'  PNG  : {charts_dir}/daily_transactions.png')
    print()
    print(summary.to_string(index=False))
