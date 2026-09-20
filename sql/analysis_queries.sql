-- 1. Executive KPIs
SELECT
    COUNT(DISTINCT order_id) AS total_orders,
    SUM(is_delivered) AS delivered_orders,
    ROUND(SUM(realized_gmv), 2) AS realized_gmv_brl,
    ROUND(SUM(realized_gmv) / NULLIF(SUM(is_delivered), 0), 2) AS average_order_value_brl,
    ROUND(AVG(CASE WHEN order_delivered_customer_date IS NOT NULL THEN is_on_time END) * 100, 2) AS on_time_rate_pct,
    ROUND(AVG(is_cancelled) * 100, 2) AS cancellation_unavailable_rate_pct,
    ROUND(AVG(review_score), 2) AS average_review_score
FROM fact_orders;

-- 2. Monthly sales trend and month-over-month growth
WITH monthly AS (
    SELECT
        SUBSTR(order_purchase_timestamp, 1, 7) AS order_month,
        COUNT(DISTINCT order_id) AS orders,
        SUM(is_delivered) AS delivered_orders,
        SUM(realized_gmv) AS realized_gmv
    FROM fact_orders
    GROUP BY 1
)
SELECT
    order_month,
    orders,
    delivered_orders,
    ROUND(realized_gmv, 2) AS realized_gmv_brl,
    ROUND(
        (realized_gmv / NULLIF(LAG(realized_gmv) OVER (ORDER BY order_month), 0) - 1) * 100,
        2
    ) AS gmv_growth_pct
FROM monthly
ORDER BY order_month;

-- 3. Repeat customer rate
WITH customer_orders AS (
    SELECT customer_unique_id, COUNT(DISTINCT order_id) AS delivered_orders
    FROM fact_orders
    WHERE is_delivered = 1
    GROUP BY customer_unique_id
)
SELECT
    COUNT(*) AS delivered_customers,
    SUM(CASE WHEN delivered_orders >= 2 THEN 1 ELSE 0 END) AS repeat_customers,
    ROUND(AVG(CASE WHEN delivered_orders >= 2 THEN 1.0 ELSE 0.0 END) * 100, 2) AS repeat_customer_rate_pct
FROM customer_orders;

-- 4. RFM segment value
SELECT
    rfm_segment,
    COUNT(*) AS customers,
    SUM(orders) AS orders,
    ROUND(SUM(total_gmv), 2) AS realized_gmv_brl,
    ROUND(AVG(avg_order_value), 2) AS avg_order_value_brl,
    ROUND(AVG(recency_days), 1) AS avg_recency_days
FROM customer_rfm
GROUP BY rfm_segment
ORDER BY realized_gmv_brl DESC;

-- 5. Top categories
SELECT
    category,
    orders,
    items,
    ROUND(realized_gmv, 2) AS realized_gmv_brl,
    ROUND(avg_item_price, 2) AS avg_item_price_brl
FROM category_performance
ORDER BY realized_gmv DESC
LIMIT 15;

-- 6. Geographic performance
SELECT
    state,
    orders,
    customers,
    ROUND(realized_gmv, 2) AS realized_gmv_brl,
    ROUND(aov, 2) AS average_order_value_brl,
    ROUND(on_time_rate * 100, 2) AS on_time_rate_pct,
    ROUND(avg_review_score, 2) AS avg_review_score
FROM state_performance
ORDER BY realized_gmv DESC;

-- 7. Delivery experience and customer satisfaction
SELECT
    delay_bucket,
    orders,
    ROUND(avg_delivery_days, 1) AS avg_delivery_days,
    ROUND(avg_review_score, 2) AS avg_review_score
FROM delivery_review
ORDER BY CASE delay_bucket
    WHEN '8+ days early' THEN 1
    WHEN '0-7 days early' THEN 2
    WHEN '1-3 days late' THEN 3
    WHEN '4-7 days late' THEN 4
    ELSE 5 END;

-- 8. Seller concentration
SELECT
    seller_id,
    seller_state,
    orders,
    items,
    ROUND(realized_gmv, 2) AS realized_gmv_brl
FROM seller_performance
ORDER BY realized_gmv DESC
LIMIT 20;

-- 9. Payment mix
SELECT
    payment_type,
    transactions,
    ROUND(payment_value, 2) AS payment_value_brl,
    ROUND(value_share * 100, 2) AS value_share_pct
FROM payment_mix
ORDER BY payment_value DESC;

-- 10. Late-delivery review penalty
SELECT
    CASE WHEN delivery_variance_days <= 0 THEN 'On time / early' ELSE 'Late' END AS delivery_result,
    COUNT(*) AS delivered_orders,
    ROUND(AVG(review_score), 2) AS avg_review_score,
    ROUND(AVG(delivery_days), 1) AS avg_delivery_days
FROM fact_orders
WHERE order_delivered_customer_date IS NOT NULL
GROUP BY 1;
