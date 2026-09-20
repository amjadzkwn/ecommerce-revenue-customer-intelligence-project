-- E-Commerce Revenue & Customer Intelligence Platform
-- SQLite analytical schema. The Python pipeline materialises these tables.

CREATE TABLE IF NOT EXISTS fact_orders (
    order_id TEXT PRIMARY KEY,
    customer_unique_id TEXT,
    customer_city TEXT,
    customer_state TEXT,
    order_status TEXT,
    order_purchase_timestamp TEXT,
    order_delivered_customer_date TEXT,
    order_estimated_delivery_date TEXT,
    purchase_month TEXT,
    item_count INTEGER,
    product_gmv REAL,
    freight_value REAL,
    order_total REAL,
    primary_payment_type TEXT,
    payment_installments INTEGER,
    review_score REAL,
    delivery_days REAL,
    delivery_variance_days REAL,
    is_delivered INTEGER,
    is_cancelled INTEGER,
    is_on_time INTEGER,
    realized_gmv REAL
);

CREATE TABLE IF NOT EXISTS customer_rfm (
    customer_unique_id TEXT PRIMARY KEY,
    first_purchase TEXT,
    last_purchase TEXT,
    orders INTEGER,
    total_gmv REAL,
    avg_order_value REAL,
    avg_review_score REAL,
    state TEXT,
    recency_days INTEGER,
    r_score INTEGER,
    f_score INTEGER,
    m_score INTEGER,
    rfm_segment TEXT,
    rfm_score TEXT
);

CREATE INDEX IF NOT EXISTS idx_fact_orders_month ON fact_orders(purchase_month);
CREATE INDEX IF NOT EXISTS idx_fact_orders_customer ON fact_orders(customer_unique_id);
CREATE INDEX IF NOT EXISTS idx_customer_rfm_segment ON customer_rfm(rfm_segment);
