import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectDir = path.resolve(".");
const outputDir = path.join(projectDir, "outputs");
const previewDir = path.join(projectDir, "assets", "excel_previews");
const payload = JSON.parse(await fs.readFile(path.join(projectDir, "app", "data", "dashboard_data.json"), "utf8"));

const wb = Workbook.create();
const exec = wb.worksheets.add("Executive");
const customer = wb.worksheets.add("Customer Intelligence");
const market = wb.worksheets.add("Market Performance");
const ops = wb.worksheets.add("Delivery & Experience");
const monthlyData = wb.worksheets.add("Data_Monthly");
const summaryData = wb.worksheets.add("Data_Summary");
const definitions = wb.worksheets.add("Definitions");

const FONT = "Arial";
const C = {
  navy: "#172033", blue: "#2457D6", violet: "#7C3AED", green: "#0F9D74",
  coral: "#D9485F", amber: "#E9A23B", ink: "#172033", muted: "#6F7890",
  line: "#E3E8F1", pale: "#F4F6FA", white: "#FFFFFF", bluePale: "#EAF0FF",
  greenPale: "#E7F6F1", redPale: "#FCECEF", violetPale: "#F1EBFF",
};

function styleBase(sheet) {
  sheet.showGridLines = false;
  sheet.getRange("A1:N100").format.font = { name: FONT, size: 10, color: C.ink };
}

function title(sheet, text, subtitle) {
  sheet.getRange("A2:N2").merge();
  sheet.getRange("A2").values = [[text]];
  sheet.getRange("A2").format.font = { name: FONT, size: 16, bold: true, color: C.navy };
  sheet.getRange("A3:N3").merge();
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange("A3").format.font = { name: FONT, size: 10, italic: true, color: C.muted };
  sheet.getRange("A4:N4").format.borders = { bottom: { style: "thin", color: C.line } };
  sheet.getRange("A1:N4").format.rowHeight = 22;
  sheet.getRange("A2:N2").format.rowHeight = 28;
}

function sectionHeader(sheet, range, text) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = { fill: C.navy, font: { name: FONT, bold: true, color: C.white, size: 10 }, verticalAlignment: "center" };
  r.format.rowHeight = 24;
}

function tableHeader(range) {
  range.format = {
    fill: C.navy,
    font: { name: FONT, bold: true, color: C.white, size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "inside", style: "thin", color: C.white },
  };
  range.format.rowHeight = 28;
}

function compactTableBody(range) {
  range.format.borders = { bottom: { style: "thin", color: C.line } };
  range.format.verticalAlignment = "center";
  range.format.rowHeight = 21;
}

function kpiCard(sheet, labelRange, valueRange, label, formula, fill, numberFormat) {
  sheet.getRange(labelRange).merge();
  sheet.getRange(valueRange).merge();
  sheet.getRange(labelRange).values = [[label]];
  sheet.getRange(valueRange).formulas = [[formula]];
  sheet.getRange(labelRange).format = {
    fill, font: { name: FONT, size: 9, bold: true, color: C.muted },
    horizontalAlignment: "left", verticalAlignment: "center",
    borders: { top: { style: "thin", color: C.line }, left: { style: "thin", color: C.line }, right: { style: "thin", color: C.line } },
  };
  sheet.getRange(valueRange).format = {
    fill, font: { name: FONT, size: 16, bold: true, color: C.navy },
    horizontalAlignment: "left", verticalAlignment: "center",
    numberFormat,
    borders: { bottom: { style: "thin", color: C.line }, left: { style: "thin", color: C.line }, right: { style: "thin", color: C.line } },
  };
}

for (const s of [exec, customer, market, ops, monthlyData, summaryData, definitions]) styleBase(s);

// Data summary: central source for KPI formulas and source citation.
summaryData.getRange("A1:C1").values = [["Metric", "Value", "Definition"]];
const summaryRows = payload.kpis.map(r => [r.metric, Number(r.value), r.definition]);
summaryData.getRangeByIndexes(1, 0, summaryRows.length, 3).values = summaryRows;
tableHeader(summaryData.getRange("A1:C1"));
compactTableBody(summaryData.getRange(`A2:C${summaryRows.length + 1}`));
summaryData.getRange("B2:B10").format.numberFormat = "#,##0.00";
summaryData.getRange("C2:C10").format.wrapText = true;
summaryData.getRange("E1").values = [["Source"]];
summaryData.getRange("E2").values = [["Brazilian E-Commerce Public Dataset by Olist"]];
summaryData.getRange("E3").values = [["https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce"]];
summaryData.getRange("E4").values = [["Delivered item value is GMV, not net platform revenue or profit."]];
summaryData.getRange("A:E").format.autofitColumns();
summaryData.getRange("A:A").format.columnWidth = 29;
summaryData.getRange("C:C").format.columnWidth = 58;
summaryData.getRange("E:E").format.columnWidth = 62;
summaryData.freezePanes.freezeRows(1);

// Monthly data for formula-driven trend chart.
const monthlyRows = payload.monthly.map(r => [
  r.purchase_month.slice(0, 7), Number(r.orders), Number(r.delivered_orders),
  Number(r.realized_gmv), Number(r.aov || 0), Number(r.cancellation_rate || 0),
  Number(r.avg_review_score || 0), r.gmv_growth_pct === null ? null : Number(r.gmv_growth_pct),
]);
monthlyData.getRange("A1:H1").values = [["Month", "Orders", "Delivered Orders", "Realized GMV (BRL)", "AOV (BRL)", "Cancellation Rate", "Average Review", "GMV Growth"]];
monthlyData.getRangeByIndexes(1, 0, monthlyRows.length, 8).values = monthlyRows;
tableHeader(monthlyData.getRange("A1:H1"));
compactTableBody(monthlyData.getRange(`A2:H${monthlyRows.length + 1}`));
monthlyData.getRange(`B2:C${monthlyRows.length + 1}`).format.numberFormat = "#,##0";
monthlyData.getRange(`D2:E${monthlyRows.length + 1}`).format.numberFormat = '"R$"#,##0.00';
monthlyData.getRange(`F2:F${monthlyRows.length + 1}`).format.numberFormat = "0.0%";
monthlyData.getRange(`G2:G${monthlyRows.length + 1}`).format.numberFormat = "0.00";
monthlyData.getRange(`H2:H${monthlyRows.length + 1}`).format.numberFormat = "0.0%";
monthlyData.getRange("A:H").format.autofitColumns();
monthlyData.freezePanes.freezeRows(1);

// Executive page.
title(exec, "E-Commerce Revenue & Customer Intelligence", "Executive view of delivered GMV, customer demand, and commercial performance · Olist public dataset");
kpiCard(exec, "A6:C6", "A7:C8", "Realized GMV", "='Data_Summary'!B4", C.bluePale, '"R$"#,##0');
kpiCard(exec, "D6:F6", "D7:F8", "Delivered Orders", "='Data_Summary'!B3", C.pale, "#,##0");
kpiCard(exec, "G6:I6", "G7:I8", "Average Order Value", "='Data_Summary'!B5", C.greenPale, '"R$"#,##0.00');
kpiCard(exec, "J6:L6", "J7:L8", "Repeat Customer Rate", "='Data_Summary'!B7", C.violetPale, "0.0%");
kpiCard(exec, "M6:N6", "M7:N8", "On-Time Rate", "='Data_Summary'!B8", C.redPale, "0.0%");
sectionHeader(exec, "A10:N10", "Monthly commercial performance · complete core period");
exec.getRange("A11:C11").values = [["Month", "Realized GMV", "Delivered Orders"]];
const execMonthly = payload.monthly
  .filter(r => Number(r.delivered_orders) >= 500)
  .map(r => [r.purchase_month.slice(0, 7), Number(r.realized_gmv), Number(r.delivered_orders)]);
exec.getRangeByIndexes(11, 0, execMonthly.length, 3).values = execMonthly;
tableHeader(exec.getRange("A11:C11"));
compactTableBody(exec.getRange(`A12:C${11 + execMonthly.length}`));
exec.getRange(`B12:B${11 + execMonthly.length}`).format.numberFormat = '"R$"#,##0';
exec.getRange(`C12:C${11 + execMonthly.length}`).format.numberFormat = "#,##0";
const trend = exec.charts.add("line", exec.getRange(`A11:B${11 + execMonthly.length}`));
trend.title = "Monthly realized GMV (BRL)";
trend.titleTextStyle.typeface = FONT;
trend.titleTextStyle.fontSize = 12;
trend.hasLegend = false;
trend.xAxis = { axisType: "textAxis", textStyle: { typeface: FONT, fontSize: 9 } };
trend.yAxis = { numberFormatCode: '"R$"0.0,,"M"', numberFormatSourceLinked: false, textStyle: { typeface: FONT, fontSize: 9 } };
trend.setPosition("E11", "N25");

sectionHeader(exec, `A${13 + execMonthly.length}:N${13 + execMonthly.length}`, "Top product categories");
const catStart = 14 + execMonthly.length;
exec.getRange(`A${catStart}:C${catStart}`).values = [["Category", "Realized GMV", "Orders"]];
const catRows = payload.categories.slice(0, 10).map(r => [r.category.replaceAll("_", " "), Number(r.realized_gmv), Number(r.orders)]);
exec.getRangeByIndexes(catStart, 0, catRows.length, 3).values = catRows;
tableHeader(exec.getRange(`A${catStart}:C${catStart}`));
compactTableBody(exec.getRange(`A${catStart + 1}:C${catStart + catRows.length}`));
exec.getRange(`B${catStart + 1}:B${catStart + catRows.length}`).format.numberFormat = '"R$"#,##0';
const categoryChart = exec.charts.add("bar", exec.getRange(`A${catStart}:B${catStart + catRows.length}`));
categoryChart.title = "Top 10 categories by realized GMV";
categoryChart.titleTextStyle.typeface = FONT;
categoryChart.titleTextStyle.fontSize = 12;
categoryChart.hasLegend = false;
categoryChart.xAxis = { numberFormatCode: '"R$"0.0,,"M"', numberFormatSourceLinked: false, textStyle: { typeface: FONT, fontSize: 9 } };
categoryChart.yAxis = { textStyle: { typeface: FONT, fontSize: 9 } };
categoryChart.setPosition(`E${catStart}`, `N${catStart + 15}`);
exec.getRange("A:N").format.columnWidth = 12;
exec.getRange("A:A").format.columnWidth = 24;
exec.getRange("B:C").format.columnWidth = 15;
exec.freezePanes.freezeRows(4);
exec.tabColor = C.blue;

// Customer Intelligence.
title(customer, "Customer Intelligence", "RFM value, repeat purchase, and acquisition-cohort retention");
kpiCard(customer, "A6:C6", "A7:C8", "Delivered Customers", "='Data_Summary'!B6", C.bluePale, "#,##0");
kpiCard(customer, "D6:F6", "D7:F8", "Repeat Customer Rate", "='Data_Summary'!B7", C.violetPale, "0.0%");
const championIndex = payload.rfm.findIndex(r => r.rfm_segment === "Champions");
const championRow = championIndex + 12;
kpiCard(customer, "G6:I6", "G7:I8", "Champion GMV Share", `=E${championRow}`, C.greenPale, "0.0%");
kpiCard(customer, "J6:L6", "J7:L8", "Customer Segments", `=COUNTA(A12:A${11 + payload.rfm.length})`, C.pale, "#,##0");
sectionHeader(customer, "A10:N10", "RFM customer portfolio");
customer.getRange("A11:E11").values = [["Segment", "Customers", "Orders", "Realized GMV", "GMV Share"]];
const rfmRows = payload.rfm.map(r => [r.rfm_segment, Number(r.customers), Number(r.orders), Number(r.gmv), Number(r.gmv_share)]);
customer.getRangeByIndexes(11, 0, rfmRows.length, 5).values = rfmRows;
tableHeader(customer.getRange("A11:E11"));
compactTableBody(customer.getRange(`A12:E${11 + rfmRows.length}`));
customer.getRange(`D12:D${11 + rfmRows.length}`).format.numberFormat = '"R$"#,##0';
customer.getRange(`E12:E${11 + rfmRows.length}`).format.numberFormat = "0.0%";
customer.getRange(`A12:E${11 + rfmRows.length}`).conditionalFormats.add("colorScale", { colors: ["#FFFFFF", C.bluePale, "#B7C9FF"], thresholds: ["min", { type: "percentile", value: 50 }, "max"] });
const rfmChart = customer.charts.add("bar", [customer.getRange(`A11:A${11 + rfmRows.length}`), customer.getRange(`D11:D${11 + rfmRows.length}`)]);
rfmChart.title = "RFM segment value";
rfmChart.titleTextStyle.typeface = FONT;
rfmChart.titleTextStyle.fontSize = 12;
rfmChart.legend = { position: "top", textStyle: { typeface: FONT } };
rfmChart.setPosition("G11", "N24");

const cohorts = [...new Set(payload.cohort.map(r => r.cohort_month))].sort().slice(-12);
const indexes = [0, 1, 2, 3, 4, 5];
const cohortMap = new Map(payload.cohort.map(r => [`${r.cohort_month}|${r.cohort_index}`, Number(r.retention_rate)]));
const cohortStart = 27;
sectionHeader(customer, `A${cohortStart}:N${cohortStart}`, "Cohort retention · latest 12 acquisition months");
customer.getRange(`A${cohortStart + 1}:G${cohortStart + 1}`).values = [["Cohort Month", "M0", "M1", "M2", "M3", "M4", "M5"]];
const cohortRows = cohorts.map(m => [m.slice(0, 7), ...indexes.map(i => cohortMap.get(`${m}|${i}`) ?? null)]);
customer.getRangeByIndexes(cohortStart + 1, 0, cohortRows.length, 7).values = cohortRows;
tableHeader(customer.getRange(`A${cohortStart + 1}:G${cohortStart + 1}`));
compactTableBody(customer.getRange(`A${cohortStart + 2}:G${cohortStart + 1 + cohortRows.length}`));
customer.getRange(`B${cohortStart + 2}:G${cohortStart + 1 + cohortRows.length}`).format.numberFormat = "0.0%";
customer.getRange(`B${cohortStart + 2}:G${cohortStart + 1 + cohortRows.length}`).conditionalFormats.add("colorScale", { colors: ["#FFFFFF", "#AFC3FF", C.blue], thresholds: ["min", { type: "percentile", value: 50 }, "max"] });
customer.getRange("A:N").format.columnWidth = 13;
customer.getRange("A:A").format.columnWidth = 23;
customer.tabColor = C.violet;

// Market Performance.
title(market, "Market Performance", "Category, geographic, payment, and seller concentration");
sectionHeader(market, "A6:N6", "State performance");
market.getRange("A7:F7").values = [["State", "Orders", "Customers", "Realized GMV", "AOV", "On-Time Rate"]];
const stateRows = payload.states.slice(0, 12).map(r => [r.state, Number(r.orders), Number(r.customers), Number(r.realized_gmv), Number(r.aov), Number(r.on_time_rate)]);
market.getRangeByIndexes(7, 0, stateRows.length, 6).values = stateRows;
tableHeader(market.getRange("A7:F7"));
compactTableBody(market.getRange(`A8:F${7 + stateRows.length}`));
market.getRange(`D8:E${7 + stateRows.length}`).format.numberFormat = '"R$"#,##0';
market.getRange(`F8:F${7 + stateRows.length}`).format.numberFormat = "0.0%";
const stateChart = market.charts.add("bar", [market.getRange(`A7:A${7 + stateRows.length}`), market.getRange(`D7:D${7 + stateRows.length}`)]);
stateChart.title = "Top states by realized GMV";
stateChart.titleTextStyle.typeface = FONT;
stateChart.titleTextStyle.fontSize = 12;
stateChart.legend = { position: "top", textStyle: { typeface: FONT } };
stateChart.setPosition("H7", "N21");

sectionHeader(market, "A23:N23", "Payment mix and leading sellers");
market.getRange("A24:C24").values = [["Payment Type", "Payment Value", "Value Share"]];
const paymentRows = payload.payments.map(r => [r.payment_type, Number(r.payment_value), Number(r.value_share)]);
market.getRangeByIndexes(24, 0, paymentRows.length, 3).values = paymentRows;
tableHeader(market.getRange("A24:C24"));
compactTableBody(market.getRange(`A25:C${24 + paymentRows.length}`));
market.getRange(`B25:B${24 + paymentRows.length}`).format.numberFormat = '"R$"#,##0';
market.getRange(`C25:C${24 + paymentRows.length}`).format.numberFormat = "0.0%";
market.getRange("E24:I24").values = [["Seller ID", "State", "Orders", "Items", "Realized GMV"]];
const sellerRows = payload.sellers.slice(0, 12).map(r => [r.seller_id, r.seller_state, Number(r.orders), Number(r.items), Number(r.realized_gmv)]);
market.getRangeByIndexes(24, 4, sellerRows.length, 5).values = sellerRows;
tableHeader(market.getRange("E24:I24"));
compactTableBody(market.getRange(`E25:I${24 + sellerRows.length}`));
market.getRange(`I25:I${24 + sellerRows.length}`).format.numberFormat = '"R$"#,##0';
market.getRange("A:N").format.columnWidth = 13;
market.getRange("A:A").format.columnWidth = 16;
market.getRange("E:E").format.columnWidth = 34;
market.tabColor = C.green;

// Delivery & Experience.
title(ops, "Delivery & Customer Experience", "Delivery variance, service level, and the review-score penalty from lateness");
kpiCard(ops, "A6:C6", "A7:C8", "On-Time Delivery Rate", "='Data_Summary'!B8", C.greenPale, "0.0%");
kpiCard(ops, "D6:F6", "D7:F8", "Cancellation / Unavailable", "='Data_Summary'!B9", C.redPale, "0.0%");
kpiCard(ops, "G6:I6", "G7:I8", "Average Review Score", "='Data_Summary'!B10", C.bluePale, "0.00");
sectionHeader(ops, "A10:N10", "Review score by delivery variance");
ops.getRange("A11:D11").values = [["Delivery Bucket", "Orders", "Average Review", "Average Delivery Days"]];
const deliveryRows = payload.deliveryReview.map(r => [r.delay_bucket, Number(r.orders), Number(r.avg_review_score), Number(r.avg_delivery_days)]);
ops.getRangeByIndexes(11, 0, deliveryRows.length, 4).values = deliveryRows;
tableHeader(ops.getRange("A11:D11"));
compactTableBody(ops.getRange(`A12:D${11 + deliveryRows.length}`));
ops.getRange(`C12:D${11 + deliveryRows.length}`).format.numberFormat = "0.00";
ops.getRange(`C12:C${11 + deliveryRows.length}`).conditionalFormats.add("colorScale", { colors: [C.coral, C.amber, C.green], thresholds: ["min", { type: "percentile", value: 50 }, "max"] });
const deliveryChart = ops.charts.add("bar", [ops.getRange(`A11:A${11 + deliveryRows.length}`), ops.getRange(`C11:C${11 + deliveryRows.length}`)]);
deliveryChart.title = "Delivery timing and customer review";
deliveryChart.titleTextStyle.typeface = FONT;
deliveryChart.titleTextStyle.fontSize = 12;
deliveryChart.legend = { position: "top", textStyle: { typeface: FONT } };
deliveryChart.yAxis = { textStyle: { typeface: FONT }, numberFormatCode: "0.0", numberFormatSourceLinked: false };
deliveryChart.setPosition("F11", "N25");
sectionHeader(ops, "A27:N27", "Service level by high-volume customer state");
ops.getRange("A28:D28").values = [["State", "Orders", "On-Time Rate", "Average Review"]];
const slaRows = payload.states.slice(0, 12).map(r => [r.state, Number(r.orders), Number(r.on_time_rate), Number(r.avg_review_score)]);
ops.getRangeByIndexes(28, 0, slaRows.length, 4).values = slaRows;
tableHeader(ops.getRange("A28:D28"));
compactTableBody(ops.getRange(`A29:D${28 + slaRows.length}`));
ops.getRange(`C29:C${28 + slaRows.length}`).format.numberFormat = "0.0%";
ops.getRange(`D29:D${28 + slaRows.length}`).format.numberFormat = "0.00";
const slaChart = ops.charts.add("bar", [ops.getRange(`A28:A${28 + slaRows.length}`), ops.getRange(`C28:C${28 + slaRows.length}`)]);
slaChart.title = "On-time rate by state";
slaChart.titleTextStyle.typeface = FONT;
slaChart.titleTextStyle.fontSize = 12;
slaChart.legend = { position: "top", textStyle: { typeface: FONT } };
slaChart.yAxis = { textStyle: { typeface: FONT }, numberFormatCode: "0%", numberFormatSourceLinked: false };
slaChart.setPosition("F28", "N42");
ops.getRange("A:N").format.columnWidth = 13;
ops.getRange("A:A").format.columnWidth = 23;
ops.tabColor = C.coral;

// Definitions.
title(definitions, "Metric Definitions & Interpretation", "Use these definitions when presenting the analysis or rebuilding it in another BI tool");
definitions.getRange("A6:C6").values = [["Metric", "Definition", "Interpretation"]];
const definitionRows = [
  ["Realized GMV", "Sum of item price for delivered orders; freight excluded.", "A merchandise-value proxy, not audited platform revenue or profit."],
  ["Average Order Value", "Realized GMV divided by delivered orders.", "Commercial basket value after restricting to completed deliveries."],
  ["Repeat Customer Rate", "Share of delivered customers with at least two delivered orders.", "Uses customer_unique_id because customer_id can change across orders."],
  ["On-Time Delivery Rate", "Actual delivery date on or before the estimated date.", "Undelivered orders and missing delivery dates are excluded."],
  ["Delivery Variance", "Actual delivery date minus estimated delivery date.", "Positive values are late; negative values are early."],
  ["RFM Segment", "Quantile-based recency, frequency, and monetary grouping.", "Action-oriented segmentation for retention and customer treatment."],
  ["Cohort Retention", "Share of an acquisition cohort active in later months.", "M0 is the acquisition month; M1 is the following month."],
];
definitions.getRangeByIndexes(6, 0, definitionRows.length, 3).values = definitionRows;
tableHeader(definitions.getRange("A6:C6"));
compactTableBody(definitions.getRange(`A7:C${6 + definitionRows.length}`));
definitions.getRange(`A7:C${6 + definitionRows.length}`).format.wrapText = true;
definitions.getRange(`A7:C${6 + definitionRows.length}`).format.rowHeight = 42;
definitions.getRange("A:A").format.columnWidth = 24;
definitions.getRange("B:C").format.columnWidth = 56;
definitions.getRange("A17:C17").merge();
definitions.getRange("A17").values = [["Source"]];
definitions.getRange("A17").format = { fill: C.navy, font: { name: FONT, bold: true, color: C.white } };
definitions.getRange("A18:C18").merge();
definitions.getRange("A18").values = [["Brazilian E-Commerce Public Dataset by Olist · https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce"]];
definitions.getRange("A18").format.font = { name: FONT, color: C.blue };
definitions.tabColor = C.muted;

wb.recalculate();

const execCheck = await wb.inspect({ kind: "table", range: "Executive!A2:N20", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 14 });
console.log(execCheck.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
for (const sheetName of ["Executive", "Customer Intelligence", "Market Performance", "Delivery & Experience", "Definitions"]) {
  const image = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${sheetName.replaceAll(" ", "_").replaceAll("&", "and")}.png`), new Uint8Array(await image.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(path.join(outputDir, "Ecommerce_Revenue_Customer_Intelligence.xlsx"));
console.log(`Saved workbook to ${path.join(outputDir, "Ecommerce_Revenue_Customer_Intelligence.xlsx")}`);
