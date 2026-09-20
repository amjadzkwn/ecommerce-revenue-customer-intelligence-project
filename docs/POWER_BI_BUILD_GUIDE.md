# Power BI build guide

## Import tables

Use the following files from `data/processed`:

- `fact_orders.csv`
- `customer_rfm.csv`
- `monthly_kpis.csv`
- `category_performance.csv`
- `state_performance.csv`
- `seller_performance.csv`
- `cohort_retention_long.csv`
- `delivery_review.csv`

Create a Date table and relate `Date[Date]` to `fact_orders[order_purchase_timestamp]` after extracting a date-only column in Power Query.

## Core measures

```DAX
Total Orders = DISTINCTCOUNT(fact_orders[order_id])

Delivered Orders =
CALCULATE(
    [Total Orders],
    fact_orders[is_delivered] = 1
)

Realized GMV = SUM(fact_orders[realized_gmv])

Average Order Value = DIVIDE([Realized GMV], [Delivered Orders])

Unique Customers = DISTINCTCOUNT(fact_orders[customer_unique_id])

On-Time Orders =
CALCULATE(
    [Total Orders],
    fact_orders[is_on_time] = 1
)

On-Time Rate =
DIVIDE(
    [On-Time Orders],
    CALCULATE([Total Orders], NOT ISBLANK(fact_orders[is_on_time]))
)

Cancelled or Unavailable Orders =
CALCULATE(
    [Total Orders],
    fact_orders[is_cancelled] = 1
)

Cancellation Rate = DIVIDE([Cancelled or Unavailable Orders], [Total Orders])

Average Review Score = AVERAGE(fact_orders[review_score])
```

## Four-page dashboard design

### 1. Executive Overview

- KPI cards: Realized GMV, Delivered Orders, AOV, Repeat Customer Rate, On-Time Rate
- Monthly line chart: Realized GMV and orders
- Bar chart: Top 10 categories by realized GMV
- State ranking: GMV, AOV, on-time rate, review score
- Slicers: purchase date, customer state, payment type

### 2. Customer Intelligence

- KPI cards: customers, repeat customers, repeat rate, customer GMV
- RFM segment bar chart
- Cohort retention matrix with conditional formatting
- Segment table: customer share, GMV share, AOV, recency
- Customer action label for Champions, At Risk, and New & Promising

### 3. Product & Market Performance

- Category GMV ranking
- Category item volume versus average item price
- State bubble plot: GMV, AOV, on-time rate
- Payment method mix
- Top seller table with GMV and order count

### 4. Delivery & Experience

- KPI cards: on-time rate, average delivery days, average review score
- Review score by delivery-delay bucket
- Late-order volume by state
- Delivery variance distribution
- Seller SLA exception table

## Formatting

- Canvas: 16:9, light neutral background
- Primary colour: `#2457D6`
- Customer accent: `#7C3AED`
- Positive: `#0F9D74`
- Risk: `#D9485F`
- Use BRL currency and one decimal place for rates
- Keep the definition of realized GMV visible in a tooltip or information panel
