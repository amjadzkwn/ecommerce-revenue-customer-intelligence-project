"""Build the analytics layer for the Olist e-commerce portfolio project.

The script reads the nine public Olist CSV files, validates their grain,
creates analysis-ready tables, and publishes a SQLite warehouse plus compact
CSV/JSON outputs for Excel and the interactive web dashboard.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
WAREHOUSE = ROOT / "data" / "warehouse"
OUTPUTS = ROOT / "outputs"
WEB_DATA = ROOT / "app" / "data"

FILES = {
    "customers": "olist_customers_dataset.csv",
    "geolocation": "olist_geolocation_dataset.csv",
    "order_items": "olist_order_items_dataset.csv",
    "payments": "olist_order_payments_dataset.csv",
    "reviews": "olist_order_reviews_dataset.csv",
    "orders": "olist_orders_dataset.csv",
    "products": "olist_products_dataset.csv",
    "sellers": "olist_sellers_dataset.csv",
    "translation": "product_category_name_translation.csv",
}


def require_files() -> None:
    missing = [name for name in FILES.values() if not (RAW / name).exists()]
    if missing:
        raise FileNotFoundError(
            "Missing source files: " + ", ".join(missing) +
            ". Download the Kaggle Olist dataset and extract it into data/raw."
        )


def load_sources() -> dict[str, pd.DataFrame]:
    require_files()
    return {key: pd.read_csv(RAW / filename) for key, filename in FILES.items()}


def month_start(series: pd.Series) -> pd.Series:
    return series.dt.to_period("M").dt.to_timestamp()


def assign_rfm_segment(row: pd.Series) -> str:
    r, f, m = int(row.r_score), int(row.f_score), int(row.m_score)
    if r >= 4 and f >= 4 and m >= 4:
        return "Champions"
    if r >= 3 and f >= 4:
        return "Loyal Customers"
    if r >= 4 and f <= 3:
        return "New & Promising"
    if r <= 2 and f >= 4:
        return "At Risk"
    if r <= 2 and f <= 2:
        return "Hibernating"
    return "Needs Attention"


def create_tables(src: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    orders = src["orders"].copy()
    customers = src["customers"].copy()
    items = src["order_items"].copy()
    payments = src["payments"].copy()
    reviews = src["reviews"].copy()
    products = src["products"].copy()
    sellers = src["sellers"].copy()
    translation = src["translation"].copy()

    date_cols = [
        "order_purchase_timestamp", "order_approved_at",
        "order_delivered_carrier_date", "order_delivered_customer_date",
        "order_estimated_delivery_date",
    ]
    for col in date_cols:
        orders[col] = pd.to_datetime(orders[col], errors="coerce")
    reviews["review_creation_date"] = pd.to_datetime(reviews["review_creation_date"], errors="coerce")

    item_agg = items.groupby("order_id", as_index=False).agg(
        item_count=("order_item_id", "count"),
        product_gmv=("price", "sum"),
        freight_value=("freight_value", "sum"),
        seller_count=("seller_id", "nunique"),
    )
    payment_agg = payments.groupby("order_id", as_index=False).agg(
        payment_value=("payment_value", "sum"),
        payment_installments=("payment_installments", "max"),
        payment_type_count=("payment_type", "nunique"),
    )
    primary_payment = (
        payments.sort_values(["order_id", "payment_value"], ascending=[True, False])
        .drop_duplicates("order_id")[["order_id", "payment_type"]]
        .rename(columns={"payment_type": "primary_payment_type"})
    )
    review_one = (
        reviews.sort_values(["order_id", "review_creation_date"])
        .drop_duplicates("order_id", keep="last")
        [["order_id", "review_score"]]
    )

    fact_orders = (
        orders.merge(customers, on="customer_id", how="left", validate="many_to_one")
        .merge(item_agg, on="order_id", how="left", validate="one_to_one")
        .merge(payment_agg, on="order_id", how="left", validate="one_to_one")
        .merge(primary_payment, on="order_id", how="left", validate="one_to_one")
        .merge(review_one, on="order_id", how="left", validate="one_to_one")
    )
    numeric = ["item_count", "product_gmv", "freight_value", "seller_count", "payment_value"]
    fact_orders[numeric] = fact_orders[numeric].fillna(0)
    fact_orders["order_total"] = fact_orders["product_gmv"] + fact_orders["freight_value"]
    fact_orders["purchase_month"] = month_start(fact_orders["order_purchase_timestamp"])
    fact_orders["delivery_days"] = (
        fact_orders["order_delivered_customer_date"] - fact_orders["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400
    fact_orders["delivery_variance_days"] = (
        fact_orders["order_delivered_customer_date"] - fact_orders["order_estimated_delivery_date"]
    ).dt.total_seconds() / 86400
    fact_orders["is_delivered"] = fact_orders["order_status"].eq("delivered").astype(int)
    fact_orders["is_cancelled"] = fact_orders["order_status"].isin(["canceled", "unavailable"]).astype(int)
    fact_orders["is_on_time"] = np.where(
        fact_orders["order_delivered_customer_date"].notna(),
        (fact_orders["order_delivered_customer_date"] <= fact_orders["order_estimated_delivery_date"]).astype(int),
        np.nan,
    )
    fact_orders["realized_gmv"] = np.where(
        fact_orders["is_delivered"].eq(1), fact_orders["product_gmv"], 0.0
    )

    products_en = products.merge(translation, on="product_category_name", how="left")
    products_en["category"] = products_en["product_category_name_english"].fillna(
        products_en["product_category_name"].fillna("unknown")
    )
    fact_items = (
        items.merge(products_en[["product_id", "category"]], on="product_id", how="left", validate="many_to_one")
        .merge(orders[["order_id", "customer_id", "order_status", "order_purchase_timestamp"]], on="order_id", how="left", validate="many_to_one")
        .merge(customers[["customer_id", "customer_unique_id", "customer_state"]], on="customer_id", how="left", validate="many_to_one")
        .merge(sellers[["seller_id", "seller_state"]], on="seller_id", how="left", validate="many_to_one")
    )
    fact_items["purchase_month"] = month_start(fact_items["order_purchase_timestamp"])
    fact_items["realized_item_gmv"] = np.where(fact_items["order_status"].eq("delivered"), fact_items["price"], 0.0)

    delivered = fact_orders[fact_orders["is_delivered"].eq(1)].copy()
    delivered_customers = delivered[delivered["customer_unique_id"].notna()].copy()

    monthly = (
        fact_orders.groupby("purchase_month", as_index=False)
        .agg(
            orders=("order_id", "nunique"),
            delivered_orders=("is_delivered", "sum"),
            customers=("customer_unique_id", "nunique"),
            realized_gmv=("realized_gmv", "sum"),
            cancelled_orders=("is_cancelled", "sum"),
            avg_review_score=("review_score", "mean"),
        )
        .sort_values("purchase_month")
    )
    monthly["aov"] = monthly["realized_gmv"] / monthly["delivered_orders"].replace(0, np.nan)
    monthly["cancellation_rate"] = monthly["cancelled_orders"] / monthly["orders"]
    monthly["gmv_growth_pct"] = monthly["realized_gmv"].pct_change()

    customer_summary = (
        delivered_customers.groupby("customer_unique_id", as_index=False)
        .agg(
            first_purchase=("order_purchase_timestamp", "min"),
            last_purchase=("order_purchase_timestamp", "max"),
            orders=("order_id", "nunique"),
            total_gmv=("product_gmv", "sum"),
            avg_order_value=("product_gmv", "mean"),
            avg_review_score=("review_score", "mean"),
            state=("customer_state", "first"),
        )
    )
    snapshot_date = delivered_customers["order_purchase_timestamp"].max().normalize() + pd.Timedelta(days=1)
    customer_summary["recency_days"] = (snapshot_date - customer_summary["last_purchase"]).dt.days
    customer_summary["r_score"] = np.ceil((1 - customer_summary["recency_days"].rank(pct=True, method="average")) * 5).clip(1, 5)
    customer_summary["f_score"] = np.ceil(customer_summary["orders"].rank(pct=True, method="average") * 5).clip(1, 5)
    customer_summary["m_score"] = np.ceil(customer_summary["total_gmv"].rank(pct=True, method="average") * 5).clip(1, 5)
    customer_summary[["r_score", "f_score", "m_score"]] = customer_summary[["r_score", "f_score", "m_score"]].astype(int)
    customer_summary["rfm_segment"] = customer_summary.apply(assign_rfm_segment, axis=1)
    customer_summary["rfm_score"] = (
        customer_summary["r_score"].astype(str)
        + customer_summary["f_score"].astype(str)
        + customer_summary["m_score"].astype(str)
    )

    rfm_summary = (
        customer_summary.groupby("rfm_segment", as_index=False)
        .agg(
            customers=("customer_unique_id", "nunique"),
            orders=("orders", "sum"),
            gmv=("total_gmv", "sum"),
            avg_order_value=("avg_order_value", "mean"),
            avg_recency_days=("recency_days", "mean"),
        )
        .sort_values("gmv", ascending=False)
    )
    rfm_summary["customer_share"] = rfm_summary["customers"] / rfm_summary["customers"].sum()
    rfm_summary["gmv_share"] = rfm_summary["gmv"] / rfm_summary["gmv"].sum()

    cohort_base = delivered_customers[["customer_unique_id", "order_purchase_timestamp"]].copy()
    cohort_base["order_month"] = month_start(cohort_base["order_purchase_timestamp"])
    first_month = cohort_base.groupby("customer_unique_id")["order_month"].min().rename("cohort_month")
    cohort_base = cohort_base.join(first_month, on="customer_unique_id")
    cohort_base["cohort_index"] = (
        (cohort_base["order_month"].dt.year - cohort_base["cohort_month"].dt.year) * 12
        + cohort_base["order_month"].dt.month - cohort_base["cohort_month"].dt.month
    )
    cohort_counts = (
        cohort_base.groupby(["cohort_month", "cohort_index"])["customer_unique_id"]
        .nunique().rename("active_customers").reset_index()
    )
    cohort_sizes = cohort_counts[cohort_counts["cohort_index"].eq(0)][["cohort_month", "active_customers"]].rename(
        columns={"active_customers": "cohort_customers"}
    )
    cohort_long = cohort_counts.merge(cohort_sizes, on="cohort_month", how="left")
    cohort_long["retention_rate"] = cohort_long["active_customers"] / cohort_long["cohort_customers"]
    cohort_matrix = cohort_long.pivot(index="cohort_month", columns="cohort_index", values="retention_rate").reset_index()
    cohort_matrix.columns = ["cohort_month"] + [f"M{int(c)}" for c in cohort_matrix.columns[1:]]

    category = (
        fact_items.groupby("category", as_index=False)
        .agg(
            orders=("order_id", "nunique"),
            items=("order_item_id", "count"),
            realized_gmv=("realized_item_gmv", "sum"),
            freight_value=("freight_value", "sum"),
            customers=("customer_unique_id", "nunique"),
        )
    )
    category["avg_item_price"] = category["realized_gmv"] / category["items"].replace(0, np.nan)
    category = category.sort_values("realized_gmv", ascending=False)

    state = (
        fact_orders.groupby("customer_state", as_index=False)
        .agg(
            orders=("order_id", "nunique"),
            delivered_orders=("is_delivered", "sum"),
            customers=("customer_unique_id", "nunique"),
            realized_gmv=("realized_gmv", "sum"),
            avg_review_score=("review_score", "mean"),
            avg_delivery_days=("delivery_days", "mean"),
            on_time_orders=("is_on_time", "sum"),
            delivered_with_date=("is_on_time", "count"),
        )
        .rename(columns={"customer_state": "state"})
    )
    state["on_time_rate"] = state["on_time_orders"] / state["delivered_with_date"].replace(0, np.nan)
    state["aov"] = state["realized_gmv"] / state["delivered_orders"].replace(0, np.nan)
    state = state.sort_values("realized_gmv", ascending=False)

    seller_perf = (
        fact_items.groupby(["seller_id", "seller_state"], as_index=False)
        .agg(
            orders=("order_id", "nunique"),
            items=("order_item_id", "count"),
            realized_gmv=("realized_item_gmv", "sum"),
            freight_value=("freight_value", "sum"),
        )
        .sort_values("realized_gmv", ascending=False)
    )

    payment_mix = (
        payments.groupby("payment_type", as_index=False)
        .agg(transactions=("order_id", "count"), payment_value=("payment_value", "sum"))
        .sort_values("payment_value", ascending=False)
    )
    payment_mix["value_share"] = payment_mix["payment_value"] / payment_mix["payment_value"].sum()

    delivery = fact_orders[fact_orders["order_delivered_customer_date"].notna()].copy()
    delivery["delivery_status"] = np.where(delivery["delivery_variance_days"] <= 0, "On time / early", "Late")
    delivery["delay_bucket"] = pd.cut(
        delivery["delivery_variance_days"],
        bins=[-np.inf, -8, -1e-9, 3, 7, np.inf],
        labels=["8+ days early", "0-7 days early", "1-3 days late", "4-7 days late", "8+ days late"],
    ).astype(str)
    delivery_review = (
        delivery.groupby("delay_bucket", as_index=False, observed=False)
        .agg(orders=("order_id", "nunique"), avg_review_score=("review_score", "mean"), avg_delivery_days=("delivery_days", "mean"))
    )

    status_summary = (
        fact_orders.groupby("order_status", as_index=False)
        .agg(orders=("order_id", "nunique"), product_gmv=("product_gmv", "sum"))
        .sort_values("orders", ascending=False)
    )

    kpis = pd.DataFrame([
        {
            "metric": "Total orders",
            "value": int(fact_orders["order_id"].nunique()),
            "definition": "Distinct orders in the source dataset",
        },
        {
            "metric": "Delivered orders",
            "value": int(delivered["order_id"].nunique()),
            "definition": "Distinct orders with order_status = delivered",
        },
        {
            "metric": "Realized GMV (BRL)",
            "value": round(float(delivered["product_gmv"].sum()), 2),
            "definition": "Sum of item price for delivered orders; not net platform revenue",
        },
        {
            "metric": "Average order value (BRL)",
            "value": round(float(delivered["product_gmv"].sum() / delivered["order_id"].nunique()), 2),
            "definition": "Delivered realized GMV divided by delivered orders",
        },
        {
            "metric": "Unique customers",
            "value": int(delivered_customers["customer_unique_id"].nunique()),
            "definition": "Distinct persistent customer identities among delivered orders",
        },
        {
            "metric": "Repeat customer rate",
            "value": float((customer_summary["orders"] >= 2).mean()),
            "definition": "Share of delivered customers with at least two delivered orders",
        },
        {
            "metric": "On-time delivery rate",
            "value": float(delivery["is_on_time"].mean()),
            "definition": "Delivered on or before the estimated delivery date",
        },
        {
            "metric": "Cancellation / unavailable rate",
            "value": float(fact_orders["is_cancelled"].mean()),
            "definition": "Orders marked canceled or unavailable divided by total orders",
        },
        {
            "metric": "Average review score",
            "value": round(float(fact_orders["review_score"].mean()), 2),
            "definition": "Mean latest review score by order",
        },
    ])

    return {
        "fact_orders": fact_orders,
        "fact_order_items": fact_items,
        "customer_rfm": customer_summary,
        "monthly_kpis": monthly,
        "rfm_summary": rfm_summary,
        "cohort_retention": cohort_matrix,
        "cohort_retention_long": cohort_long,
        "category_performance": category,
        "state_performance": state,
        "seller_performance": seller_perf,
        "payment_mix": payment_mix,
        "delivery_review": delivery_review,
        "order_status_summary": status_summary,
        "executive_kpis": kpis,
    }


def quality_report(src: dict[str, pd.DataFrame], tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    pk_checks = {
        "orders.order_id": (src["orders"], "order_id"),
        "customers.customer_id": (src["customers"], "customer_id"),
        "products.product_id": (src["products"], "product_id"),
        "sellers.seller_id": (src["sellers"], "seller_id"),
    }
    for check, (df, col) in pk_checks.items():
        rows.append({
            "check": check,
            "rows": len(df),
            "missing": int(df[col].isna().sum()),
            "duplicates": int(df[col].duplicated().sum()),
            "status": "PASS" if df[col].isna().sum() == 0 and df[col].duplicated().sum() == 0 else "REVIEW",
        })
    fact = tables["fact_orders"]
    rows.extend([
        {
            "check": "fact_orders one row per order",
            "rows": len(fact), "missing": 0,
            "duplicates": int(fact["order_id"].duplicated().sum()),
            "status": "PASS" if fact["order_id"].is_unique else "FAIL",
        },
        {
            "check": "orders matched to customer",
            "rows": len(fact),
            "missing": int(fact["customer_unique_id"].isna().sum()),
            "duplicates": 0,
            "status": "PASS" if fact["customer_unique_id"].notna().all() else "REVIEW",
        },
        {
            "check": "delivered order dates available",
            "rows": int(fact["is_delivered"].sum()),
            "missing": int(fact.loc[fact["is_delivered"].eq(1), "order_delivered_customer_date"].isna().sum()),
            "duplicates": 0,
            "status": "PASS" if fact.loc[fact["is_delivered"].eq(1), "order_delivered_customer_date"].notna().mean() > 0.99 else "REVIEW",
        },
    ])
    return pd.DataFrame(rows)


def export_csvs(tables: dict[str, pd.DataFrame], quality: pd.DataFrame) -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    compact = [
        "executive_kpis", "monthly_kpis", "rfm_summary", "cohort_retention",
        "cohort_retention_long", "category_performance", "state_performance",
        "seller_performance", "payment_mix", "delivery_review", "order_status_summary",
    ]
    for name in compact:
        tables[name].to_csv(PROCESSED / f"{name}.csv", index=False)
    fact_cols = [
        "order_id", "customer_unique_id", "customer_city", "customer_state",
        "order_status", "order_purchase_timestamp", "purchase_month", "item_count",
        "product_gmv", "freight_value", "order_total", "primary_payment_type",
        "payment_installments", "review_score", "delivery_days", "delivery_variance_days",
        "is_delivered", "is_cancelled", "is_on_time", "realized_gmv",
    ]
    tables["fact_orders"][fact_cols].to_csv(PROCESSED / "fact_orders.csv", index=False)
    tables["customer_rfm"].to_csv(PROCESSED / "customer_rfm.csv", index=False)
    quality.to_csv(OUTPUTS / "data_quality_report.csv", index=False)


def export_sqlite(src: dict[str, pd.DataFrame], tables: dict[str, pd.DataFrame]) -> None:
    WAREHOUSE.mkdir(parents=True, exist_ok=True)
    db_path = WAREHOUSE / "ecommerce_analytics.db"
    if db_path.exists():
        db_path.unlink()
    with sqlite3.connect(db_path) as conn:
        for name in [
            "fact_orders", "customer_rfm", "monthly_kpis",
            "rfm_summary", "cohort_retention_long", "category_performance",
            "state_performance", "seller_performance", "payment_mix", "delivery_review",
        ]:
            tables[name].to_sql(name, conn, index=False, if_exists="replace")
        conn.executescript(
            """
            CREATE INDEX idx_fact_orders_date ON fact_orders(order_purchase_timestamp);
            CREATE INDEX idx_fact_orders_customer ON fact_orders(customer_unique_id);
            CREATE INDEX idx_customer_rfm_segment ON customer_rfm(rfm_segment);
            """
        )


def export_dashboard_json(tables: dict[str, pd.DataFrame]) -> None:
    WEB_DATA.mkdir(parents=True, exist_ok=True)

    def records(df: pd.DataFrame) -> list[dict[str, object]]:
        safe = df.copy()
        for col in safe.select_dtypes(include=["datetime", "datetimetz"]).columns:
            safe[col] = safe[col].dt.strftime("%Y-%m-%d")
        safe = safe.replace({np.nan: None, np.inf: None, -np.inf: None})
        return safe.to_dict(orient="records")

    payload = {
        "kpis": records(tables["executive_kpis"]),
        "monthly": records(tables["monthly_kpis"]),
        "rfm": records(tables["rfm_summary"]),
        "categories": records(tables["category_performance"].head(20)),
        "states": records(tables["state_performance"]),
        "sellers": records(tables["seller_performance"].head(20)),
        "payments": records(tables["payment_mix"]),
        "deliveryReview": records(tables["delivery_review"]),
        "status": records(tables["order_status_summary"]),
        "cohort": records(tables["cohort_retention_long"]),
        "meta": {
            "currency": "BRL",
            "gmvDefinition": "Item price for delivered orders; freight excluded",
            "source": "Brazilian E-Commerce Public Dataset by Olist",
            "snapshot": str(tables["fact_orders"]["order_purchase_timestamp"].max()),
        },
    }
    (WEB_DATA / "dashboard_data.json").write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")


def export_insights(tables: dict[str, pd.DataFrame]) -> None:
    kpi = tables["executive_kpis"].set_index("metric")["value"]
    categories = tables["category_performance"].head(5)
    states = tables["state_performance"].head(5)
    delivery = tables["delivery_review"].set_index("delay_bucket")
    rfm = tables["rfm_summary"].set_index("rfm_segment")

    insights = [
        "# Key business insights",
        "",
        f"- Delivered orders generated **R$ {kpi['Realized GMV (BRL)']:,.2f}** in realized merchandise value, with an average order value of **R$ {kpi['Average order value (BRL)']:,.2f}**.",
        f"- The repeat-customer rate is **{kpi['Repeat customer rate']:.1%}**, making first-to-second purchase conversion the clearest customer-growth opportunity.",
        f"- **{kpi['On-time delivery rate']:.1%}** of orders with a delivery date arrived by the estimate. Delivery experience is materially linked to review score.",
        f"- The top categories by realized GMV are **{', '.join(categories['category'].astype(str).tolist())}**.",
        f"- The leading customer states by realized GMV are **{', '.join(states['state'].astype(str).tolist())}**, showing substantial geographic concentration.",
    ]
    if "8+ days late" in delivery.index and "8+ days early" in delivery.index:
        insights.append(
            f"- Orders delivered 8+ days late average **{delivery.loc['8+ days late', 'avg_review_score']:.2f}** stars versus **{delivery.loc['8+ days early', 'avg_review_score']:.2f}** for orders delivered at least 8 days early."
        )
    if "Champions" in rfm.index:
        insights.append(
            f"- The Champions segment represents **{rfm.loc['Champions', 'customer_share']:.1%}** of customers and **{rfm.loc['Champions', 'gmv_share']:.1%}** of delivered GMV."
        )
    insights += [
        "",
        "## Recommended actions",
        "",
        "1. Launch a 30–45 day second-purchase journey for recent one-time buyers, using the customer's first category as the recommendation anchor.",
        "2. Prioritise delivery-SLA fixes in states and sellers with high late-order volume, then measure review-score lift after improvement.",
        "3. Protect top-GMV categories while testing cross-sell bundles that raise order value without increasing delivery risk.",
        "",
        "## Important interpretation note",
        "",
        "The public dataset does not contain Olist's commission, cost of goods, marketing spend, or profit. This project therefore uses delivered item value as realized GMV, not audited company revenue or profit.",
    ]
    (OUTPUTS / "key_business_insights.md").write_text("\n".join(insights), encoding="utf-8")


def export_manifest(src: dict[str, pd.DataFrame], tables: dict[str, pd.DataFrame]) -> None:
    manifest = {
        "source": "https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce",
        "source_title": "Brazilian E-Commerce Public Dataset by Olist",
        "source_rows": {name: int(len(df)) for name, df in src.items()},
        "output_rows": {name: int(len(df)) for name, df in tables.items()},
        "date_min": str(tables["fact_orders"]["order_purchase_timestamp"].min()),
        "date_max": str(tables["fact_orders"]["order_purchase_timestamp"].max()),
        "currency": "BRL",
    }
    (OUTPUTS / "build_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    for path in [PROCESSED, WAREHOUSE, OUTPUTS, WEB_DATA]:
        path.mkdir(parents=True, exist_ok=True)
    sources = load_sources()
    tables = create_tables(sources)
    quality = quality_report(sources, tables)
    export_csvs(tables, quality)
    export_sqlite(sources, tables)
    export_dashboard_json(tables)
    export_insights(tables)
    export_manifest(sources, tables)
    print(tables["executive_kpis"].to_string(index=False))
    print(f"\nWarehouse: {WAREHOUSE / 'ecommerce_analytics.db'}")


if __name__ == "__main__":
    main()
