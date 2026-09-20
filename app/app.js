const state = { data: null, charts: {}, from: null, to: null, topN: 10 };

const palette = {
  blue: '#2457D6', violet: '#7C3AED', green: '#0F9D74', coral: '#D9485F',
  amber: '#E9A23B', cyan: '#22A5A1', muted: '#AAB4C8'
};

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0);
const percent = value => `${((value || 0) * 100).toFixed(1)}%`;
const score = value => `${Number(value || 0).toFixed(2)} / 5`;
const monthLabel = value => new Date(`${value.slice(0, 7)}-02T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
Chart.defaults.color = '#7B8499';
Chart.defaults.plugins.legend.labels.usePointStyle = true;

function createChart(id, config) {
  if (state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new Chart(document.getElementById(id), config);
}

function chartOptions({ horizontal = false, percentAxis = false, legend = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { display: legend, position: 'top' }, tooltip: { padding: 11, displayColors: true } },
    scales: {
      x: { grid: { display: false }, ticks: percentAxis && !horizontal ? { callback: v => `${v}%` } : {} },
      y: { grid: { color: 'rgba(130,140,165,.13)' }, beginAtZero: true, ticks: percentAxis && horizontal ? { callback: v => `${v}%` } : {} }
    }
  };
}

function filteredMonthly() {
  return state.data.monthly.filter(row => {
    const month = row.purchase_month.slice(0, 7);
    return month >= state.from && month <= state.to;
  });
}

function updateOverview() {
  const rows = filteredMonthly();
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const delivered = rows.reduce((s, r) => s + r.delivered_orders, 0);
  const gmv = rows.reduce((s, r) => s + r.realized_gmv, 0);
  const reviewWeight = rows.reduce((s, r) => s + (r.avg_review_score || 0) * r.orders, 0);
  const review = totalOrders ? reviewWeight / totalOrders : 0;
  document.getElementById('kpi-gmv').textContent = money(gmv);
  document.getElementById('kpi-orders').textContent = number(delivered);
  document.getElementById('kpi-order-share').textContent = `${percent(delivered / totalOrders)} of placed orders`;
  document.getElementById('kpi-aov').textContent = money(gmv / delivered);
  document.getElementById('kpi-review').textContent = score(review);
  document.getElementById('data-period').textContent = `${monthLabel(state.from)} – ${monthLabel(state.to)}`;

  createChart('monthly-chart', {
    type: 'line',
    data: {
      labels: rows.map(r => monthLabel(r.purchase_month)),
      datasets: [{ label: 'Realized GMV', data: rows.map(r => r.realized_gmv), borderColor: palette.blue, backgroundColor: 'rgba(36,87,214,.12)', fill: true, tension: .32, pointRadius: 2, borderWidth: 2.5 }]
    },
    options: { ...chartOptions(), plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.raw) } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }, y: { beginAtZero: true, grid: { color: 'rgba(130,140,165,.13)' }, ticks: { callback: v => `R$${(v / 1e6).toFixed(1)}M` } } } }
  });

  const status = state.data.status.slice(0, 6);
  createChart('status-chart', {
    type: 'doughnut',
    data: { labels: status.map(r => r.order_status), datasets: [{ data: status.map(r => r.orders), backgroundColor: [palette.blue, palette.coral, palette.amber, palette.violet, palette.green, palette.muted], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, padding: 15 } } } }
  });

  const cats = state.data.categories.slice(0, state.topN).reverse();
  createChart('category-chart', {
    type: 'bar',
    data: { labels: cats.map(r => r.category.replaceAll('_', ' ')), datasets: [{ label: 'Realized GMV', data: cats.map(r => r.realized_gmv), backgroundColor: palette.violet, borderRadius: 5 }] },
    options: { ...chartOptions({ horizontal: true }), plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.raw) } } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(130,140,165,.13)' }, ticks: { callback: v => `R$${(v / 1e3).toFixed(0)}k` } }, y: { grid: { display: false } } } }
  });
}

function segmentAction(segment) {
  const actions = {
    'Champions': 'Protect with early access and referral rewards',
    'Loyal Customers': 'Cross-sell adjacent categories',
    'New & Promising': 'Drive the second purchase within 45 days',
    'At Risk': 'Win back with service recovery and relevance',
    'Hibernating': 'Use a low-cost reactivation test',
    'Needs Attention': 'Personalise by recency and first category'
  };
  return actions[segment] || 'Review segment behaviour';
}

function updateCustomers() {
  const kpis = Object.fromEntries(state.data.kpis.map(r => [r.metric, r.value]));
  const champion = state.data.rfm.find(r => r.rfm_segment === 'Champions');
  document.getElementById('customer-count').textContent = number(kpis['Unique customers']);
  document.getElementById('repeat-rate').textContent = percent(kpis['Repeat customer rate']);
  document.getElementById('champion-share').textContent = percent(champion?.gmv_share);
  document.getElementById('segment-count').textContent = number(state.data.rfm.length);

  const rfm = [...state.data.rfm].sort((a, b) => a.gmv - b.gmv);
  createChart('rfm-chart', {
    type: 'bar',
    data: { labels: rfm.map(r => r.rfm_segment), datasets: [{ label: 'Realized GMV', data: rfm.map(r => r.gmv), backgroundColor: [palette.muted, palette.coral, palette.amber, palette.cyan, palette.violet, palette.blue], borderRadius: 5 }] },
    options: { ...chartOptions({ horizontal: true }), plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.raw) } } }, scales: { x: { grid: { color: 'rgba(130,140,165,.13)' }, ticks: { callback: v => `R$${(v / 1e6).toFixed(1)}M` } }, y: { grid: { display: false } } } }
  });

  const rows = [...state.data.rfm].sort((a, b) => b.gmv - a.gmv);
  document.getElementById('rfm-table').innerHTML = `<table><thead><tr><th>Segment</th><th class="numeric">Customers</th><th class="numeric">GMV share</th><th class="numeric">AOV</th><th>Recommended action</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${r.rfm_segment}</strong></td><td class="numeric">${number(r.customers)}</td><td class="numeric">${percent(r.gmv_share)}</td><td class="numeric">${money(r.avg_order_value)}</td><td>${segmentAction(r.rfm_segment)}</td></tr>`).join('')}</tbody></table>`;
  renderCohort();
}

function renderCohort() {
  const months = [...new Set(state.data.cohort.map(r => r.cohort_month))].sort().slice(-12);
  const indexes = [0, 1, 2, 3, 4, 5];
  const map = new Map(state.data.cohort.map(r => [`${r.cohort_month}|${r.cohort_index}`, r.retention_rate]));
  const header = `<tr><th>Cohort</th>${indexes.map(i => `<th class="numeric">M${i}</th>`).join('')}</tr>`;
  const body = months.map(m => `<tr><td>${monthLabel(m)}</td>${indexes.map(i => {
    const v = map.get(`${m}|${i}`);
    if (v === undefined) return '<td>—</td>';
    const alpha = Math.max(.12, Math.min(.95, v * (i === 0 ? .9 : 8)));
    return `<td class="cohort-cell" style="background:rgba(36,87,214,${alpha})">${percent(v)}</td>`;
  }).join('')}</tr>`).join('');
  document.getElementById('cohort-table').innerHTML = `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
}

function updateMarket() {
  const states = state.data.states.slice(0, 12).reverse();
  createChart('state-chart', {
    type: 'bar', data: { labels: states.map(r => r.state), datasets: [{ label: 'Realized GMV', data: states.map(r => r.realized_gmv), backgroundColor: palette.blue, borderRadius: 5 }] },
    options: { ...chartOptions({ horizontal: true }), plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.raw) } } }, scales: { x: { grid: { color: 'rgba(130,140,165,.13)' }, ticks: { callback: v => `R$${(v / 1e6).toFixed(1)}M` } }, y: { grid: { display: false } } } }
  });
  createChart('payment-chart', {
    type: 'doughnut', data: { labels: state.data.payments.map(r => r.payment_type), datasets: [{ data: state.data.payments.map(r => r.payment_value), backgroundColor: [palette.blue, palette.violet, palette.green, palette.amber, palette.coral], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${money(ctx.raw)}` } } } }
  });
  const sellers = state.data.sellers.slice(0, 12);
  document.getElementById('seller-table').innerHTML = `<table><thead><tr><th>Rank</th><th>Seller ID</th><th>State</th><th class="numeric">Orders</th><th class="numeric">Items</th><th class="numeric">Realized GMV</th></tr></thead><tbody>${sellers.map((r, i) => `<tr><td>${i + 1}</td><td>${r.seller_id.slice(0, 12)}…</td><td>${r.seller_state}</td><td class="numeric">${number(r.orders)}</td><td class="numeric">${number(r.items)}</td><td class="numeric"><strong>${money(r.realized_gmv)}</strong></td></tr>`).join('')}</tbody></table>`;
}

function updateOperations() {
  const kpis = Object.fromEntries(state.data.kpis.map(r => [r.metric, r.value]));
  const early = state.data.deliveryReview.find(r => r.delay_bucket === '8+ days early');
  const late = state.data.deliveryReview.find(r => r.delay_bucket === '8+ days late');
  document.getElementById('ontime-rate').textContent = percent(kpis['On-time delivery rate']);
  document.getElementById('late-review').textContent = score(late?.avg_review_score);
  document.getElementById('early-review').textContent = score(early?.avg_review_score);
  document.getElementById('review-gap').textContent = `${((early?.avg_review_score || 0) - (late?.avg_review_score || 0)).toFixed(2)} stars`;
  const delivery = state.data.deliveryReview;
  createChart('delivery-chart', {
    type: 'bar', data: { labels: delivery.map(r => r.delay_bucket), datasets: [{ label: 'Average review', data: delivery.map(r => r.avg_review_score), backgroundColor: [palette.green, palette.cyan, palette.amber, '#E47855', palette.coral], borderRadius: 6 }] },
    options: { ...chartOptions(), plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, max: 5, grid: { color: 'rgba(130,140,165,.13)' } } } }
  });
  const states = state.data.states.slice(0, 12);
  createChart('sla-chart', {
    type: 'bar', data: { labels: states.map(r => r.state), datasets: [{ label: 'On-time rate', data: states.map(r => r.on_time_rate * 100), backgroundColor: states.map(r => r.on_time_rate >= .9 ? palette.green : palette.coral), borderRadius: 5 }] },
    options: { ...chartOptions({ percentAxis: true }), plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw.toFixed(1)}%` } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, max: 100, grid: { color: 'rgba(130,140,165,.13)' }, ticks: { callback: v => `${v}%` } } } }
  });
}

function refresh() { updateOverview(); updateCustomers(); updateMarket(); updateOperations(); }

function setupControls() {
  const months = state.data.monthly
    .filter(r => Number(r.delivered_orders) >= 500)
    .map(r => r.purchase_month.slice(0, 7))
    .sort();
  const from = document.getElementById('from-month');
  const to = document.getElementById('to-month');
  from.innerHTML = months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  to.innerHTML = from.innerHTML;
  state.from = months[0]; state.to = months[months.length - 1];
  from.value = state.from; to.value = state.to;
  from.addEventListener('change', e => { state.from = e.target.value; if (state.from > state.to) { state.to = state.from; to.value = state.to; } refresh(); });
  to.addEventListener('change', e => { state.to = e.target.value; if (state.to < state.from) { state.from = state.to; from.value = state.from; } refresh(); });
  document.getElementById('top-n').addEventListener('change', e => { state.topN = Number(e.target.value); updateOverview(); });
  document.getElementById('reset-filters').addEventListener('click', () => { state.from = months[0]; state.to = months[months.length - 1]; state.topN = 10; from.value = state.from; to.value = state.to; document.getElementById('top-n').value = '10'; refresh(); });
  document.querySelectorAll('.nav-button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-button, .view').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.view).classList.add('active');
  }));
  document.getElementById('theme-toggle').addEventListener('click', () => document.body.classList.toggle('dark'));
}

async function init() {
  try {
    const response = await fetch('data/dashboard_data.json');
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    state.data = await response.json();
    setupControls(); refresh();
  } catch (error) {
    document.querySelector('main').innerHTML = `<article class="panel"><h1>Dashboard data could not load</h1><p>Run this folder through a local web server, for example <code>python -m http.server 8000 --directory app</code>, then open <code>http://localhost:8000</code>.</p><p>${error.message}</p></article>`;
  }
}

init();
