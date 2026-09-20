"""Lightweight regression checks for generated analytical outputs."""

from pathlib import Path
import json
import sqlite3

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    manifest = json.loads((ROOT / "outputs" / "build_manifest.json").read_text())
    assert manifest["source_rows"]["orders"] == 99_441

    kpis = pd.read_csv(ROOT / "data" / "processed" / "executive_kpis.csv").set_index("metric")["value"]
    assert int(kpis["Total orders"]) == 99_441
    assert int(kpis["Delivered orders"]) == 96_478
    assert 13_000_000 < kpis["Realized GMV (BRL)"] < 14_000_000
    assert 0.02 < kpis["Repeat customer rate"] < 0.04
    assert 0.90 < kpis["On-time delivery rate"] < 0.94

    fact = pd.read_csv(ROOT / "data" / "processed" / "fact_orders.csv", usecols=["order_id"])
    assert len(fact) == fact["order_id"].nunique() == 99_441

    with sqlite3.connect(ROOT / "data" / "warehouse" / "ecommerce_analytics.db") as conn:
        rows = conn.execute("SELECT COUNT(*) FROM fact_orders").fetchone()[0]
        assert rows == 99_441

    dashboard = json.loads((ROOT / "app" / "data" / "dashboard_data.json").read_text())
    assert len(dashboard["monthly"]) >= 20
    assert len(dashboard["categories"]) == 20
    assert len(dashboard["states"]) == 27
    print("All analytical output checks passed.")


if __name__ == "__main__":
    main()
