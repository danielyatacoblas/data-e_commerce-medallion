"""
Generador de eventos masivos para el pipeline Medallón.

Envía 120 eventos al POST /v1/events con datos realistas de 5 categorías
distribuidos en 30 días, luego obtiene las métricas Gold y las guarda en
gold_data.json para que report.py las analice.

Uso:
    python generate_events.py
"""

import json
import random
import urllib.request
import urllib.error
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000"

CATEGORIAS = {
    "Electronics":    {"precio_min": 99.99,  "precio_max": 999.99, "qty_max": 2},
    "Clothing":       {"precio_min": 19.99,  "precio_max": 149.99, "qty_max": 4},
    "Home & Garden":  {"precio_min": 29.99,  "precio_max": 299.99, "qty_max": 3},
    "Sports":         {"precio_min": 24.99,  "precio_max": 199.99, "qty_max": 3},
    "Books":          {"precio_min":  9.99,  "precio_max":  49.99, "qty_max": 5},
}

FECHA_INICIO = datetime(2026, 4, 22)


def generar_eventos(total: int = 120) -> list:
    random.seed(42)
    eventos = []
    categorias = list(CATEGORIAS.keys())

    for i in range(total):
        categoria = random.choice(categorias)
        cfg = CATEGORIAS[categoria]
        precio = round(random.uniform(cfg["precio_min"], cfg["precio_max"]), 2)
        cantidad = random.randint(1, cfg["qty_max"])
        dias = random.randint(0, 29)
        fecha = FECHA_INICIO + timedelta(days=dias)
        hora = f"{random.randint(8, 20):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}"

        eventos.append({
            "transaction_id": f"tx_{i + 1:04d}",
            "customer_id":    f"usr_{random.randint(1000, 9999)}",
            "timestamp":      f"{fecha.strftime('%Y-%m-%d')} {hora} UTC",
            "product": {
                "id":       f"prod_{random.randint(100, 999)}",
                "category": categoria,
                "price":    precio,
            },
            "quantity": cantidad,
        })

    return eventos


def post_evento(evento: dict) -> dict:
    data = json.dumps(evento).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/v1/events",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def get_metricas() -> list:
    with urllib.request.urlopen(f"{BASE_URL}/v1/metrics/category-sales") as resp:
        return json.loads(resp.read())


if __name__ == "__main__":
    eventos = generar_eventos(120)
    print(f"Enviando {len(eventos)} eventos al pipeline...")

    for i, evento in enumerate(eventos, 1):
        resultado = post_evento(evento)
        if i % 20 == 0:
            print(f"  {i}/{len(eventos)} — ultimo: {resultado['transaction_id']} -> {resultado['status']}")

    print("\nObteniendo metricas Gold (Bronze -> Silver -> Gold)...")
    gold_data = get_metricas()
    print(f"  Registros agregados: {len(gold_data)}")

    output_path = "gold_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(gold_data, f, indent=2, ensure_ascii=False)

    print(f"\nGuardado: {output_path}")
    print("\nResumen por categoria:")
    totales: dict = {}
    for r in gold_data:
        cat = r["category"]
        totales[cat] = totales.get(cat, 0) + r["total_sales"]
    for cat, total in sorted(totales.items()):
        print(f"  {cat:<20} ${total:>10,.2f}")
