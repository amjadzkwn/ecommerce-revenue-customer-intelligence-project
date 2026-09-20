# Data dictionary

## Core business metrics

| Metric | Definition |
| --- | --- |
| Total orders | Distinct `order_id` across all order statuses |
| Delivered orders | Distinct orders where `order_status = delivered` |
| Product GMV | Sum of order-item price, excluding freight |
| Realized GMV | Product GMV for delivered orders only |
| Average order value | Realized GMV divided by delivered orders |
| Repeat customer rate | Share of delivered customers with at least two delivered orders |
| On-time delivery rate | Share of orders with an actual delivery date delivered on or before the estimate |
| Cancellation / unavailable rate | Orders marked canceled or unavailable divided by total orders |
| Delivery variance days | Actual delivery date minus estimated delivery date; positive values are late |
| Average review score | Mean latest review score for each order |

## `fact_orders`

| Field | Grain / meaning |
| --- | --- |
| `order_id` | Unique order identifier; primary key |
| `customer_unique_id` | Persistent customer identity used across repeat orders |
| `customer_city`, `customer_state` | Customer geography |
| `order_status` | Current/final source status |
| `order_purchase_timestamp` | Order creation time |
| `purchase_month` | First day of purchase month |
| `item_count` | Number of order-item records |
| `product_gmv` | Sum of item price for the order |
| `freight_value` | Sum of item-level freight |
| `order_total` | Product GMV plus freight |
| `primary_payment_type` | Payment type with the highest payment value for the order |
| `payment_installments` | Maximum instalment count recorded for the order |
| `review_score` | Latest review score for the order |
| `delivery_days` | Days from purchase to customer delivery |
| `delivery_variance_days` | Actual delivery date minus estimated date |
| `is_delivered` | 1 when delivered, otherwise 0 |
| `is_cancelled` | 1 when canceled or unavailable, otherwise 0 |
| `is_on_time` | 1 when delivery is on/before estimate, 0 when late, blank when undelivered |
| `realized_gmv` | Product GMV when delivered, otherwise 0 |

## `customer_rfm`

| Field | Meaning |
| --- | --- |
| `customer_unique_id` | Persistent customer identity |
| `first_purchase`, `last_purchase` | First and latest delivered purchase timestamps |
| `orders` | Delivered order frequency |
| `total_gmv` | Delivered customer GMV |
| `recency_days` | Days since last purchase at the dataset snapshot |
| `r_score`, `f_score`, `m_score` | Quantile-based scores from 1 to 5 |
| `rfm_segment` | Business-friendly customer group |
| `rfm_score` | Concatenated three-digit RFM score |

## Source caveats

- The period is historical and should be presented as a portfolio case, not a current market forecast.
- The dataset does not contain profit, commission, cost of goods, marketing acquisition cost, or inventory cost.
- A high association between lateness and low review score does not by itself establish causality.
- A customer may have different `customer_id` values across orders; repeat analysis must use `customer_unique_id`.
