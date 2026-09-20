# Portfolio case study

## Project

**E-Commerce Revenue & Customer Intelligence Platform**

## Situation

An e-commerce marketplace has order, customer, product, payment, seller, and review data in separate tables. Leaders cannot easily connect revenue performance with repeat purchase, delivery reliability, and customer satisfaction.

## Task

Create a single analytical platform that gives commercial, customer, and operations teams a consistent view of performance and clear actions.

## Approach

1. Validated nine source tables and their business grain.
2. Built an order-level analytical fact table without double-counting items or payments.
3. Defined realized GMV as delivered item value and documented its limitation.
4. Created monthly KPI, category, state, payment, seller, and delivery-performance outputs.
5. Used persistent `customer_unique_id` to calculate repeat purchase and RFM segments.
6. Built monthly acquisition cohorts and retention rates.
7. Published results in SQL, Excel, and a browser-based dashboard.

## Business findings

- Delivered GMV reached R$13.22M across 96,478 delivered orders.
- Only 3.0% of delivered customers purchased at least twice.
- On-time delivery reached 91.9%, but late delivery carried a severe experience cost.
- Reviews averaged 4.32 for orders delivered at least eight days early and 1.73 for orders at least eight days late.
- Commercial value is concentrated in a small group of categories and southeastern states.

## Recommendations

### Convert the second purchase

Trigger a personalised journey 30–45 days after the first delivered order. Use the original category, order value, and review score to tailor the offer. Measure second-order conversion and incremental GMV against a holdout group.

### Prioritise delivery-risk reduction

Create a weekly seller-state SLA watchlist using late-order count, delivery variance, and review score. Start with high-volume combinations where delay reduction can influence the largest number of customers.

### Grow order value carefully

Test category bundles and cross-sell recommendations in the highest-GMV categories. Track whether higher basket size changes freight burden, delivery time, or review score.

## Skills demonstrated

- Python: pandas, data validation, RFM scoring, cohort analysis
- SQL: joins, CTEs, conditional aggregation, window functions
- Excel: KPI dashboard, trend and comparison charts, management tables
- Data modelling: relational source model and order-level analytical layer
- Business analysis: metric definitions, limitations, recommendations, experiment design
- Data storytelling: recruiter-facing dashboard and concise case study

## Interview talking points

- Why item and payment tables must be aggregated separately before joining to orders.
- Why `customer_unique_id`, not `customer_id`, is required for repeat-purchase analysis.
- Why delivered item value is GMV rather than accounting revenue.
- How late-delivery review impact suggests prioritisation but does not alone prove causality.
- How a retention campaign could be evaluated using a randomised holdout group.
