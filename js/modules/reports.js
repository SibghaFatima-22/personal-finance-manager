/**
 * reports.js — Full Reports Module
 * Personal Finance Manager
 *
 * Features:
 *  - Three tabs: Weekly / Monthly / Yearly
 *  - Period navigator (prev / next / back to current)
 *  - Summary cards: income, expenses, balance, savings rate
 *  - Income vs Expense bar chart
 *  - Category breakdown donut + table
 *  - Daily spending line chart (monthly view)
 *  - Day-of-week bar chart (weekly view)
 *  - Monthly trend bars (yearly view)
 *  - Top 5 largest transactions
 *  - Smart insights (biggest category, avg daily spend, best day)
 *  - Export report as CSV
 */

import { TransactionDB, seedDemoData } from '../db.js';
import {
  formatCurrency, formatDate, formatDateShort,
  getCurrentMonth, getMonthName, getMonthRange,
  getWeekRange, getYearRange,
  CATEGORY_ICONS, CATEGORY_COLORS,
  showToast,
} from '../utils/helpers.js';

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  tab: 'monthly',          // 'weekly' | 'monthly' | 'yearly'
  monthOffset:  0,         // 0 = current month
  weekOffset:   0,         // 0 = current week
  yearOffset:   0,         // 0 = current year
};

// Chart instances — destroyed before re-creating
const charts = {};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  buildShell();
  render();
});

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  const root = document.getElementById('reportsRoot');
  if (!root) return;
  root.innerHTML = `
    <!-- Tab Bar -->
    <div class="report-tabs">
      <button class="report-tab active" data-tab="weekly">📅 Weekly</button>
      <button class="report-tab" data-tab="monthly">📆 Monthly</button>
      <button class="report-tab" data-tab="yearly">📊 Yearly</button>
    </div>
    <!-- Dynamic content injected below -->
    <div id="reportContent"></div>`;

  root.querySelectorAll('.report-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.report-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tab = btn.dataset.tab;
      // Reset offsets when switching tabs
      state.weekOffset  = 0;
      state.monthOffset = 0;
      state.yearOffset  = 0;
      render();
    });
  });
}

// ─── Main Render dispatcher ───────────────────────────────────────────────────

function render() {
  destroyAllCharts();
  if      (state.tab === 'weekly')  renderWeekly();
  else if (state.tab === 'monthly') renderMonthly();
  else if (state.tab === 'yearly')  renderYearly();
}

function destroyAllCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e) {} });
  Object.keys(charts).forEach(k => delete charts[k]);
}

// ─── Shared: Period Navigator ─────────────────────────────────────────────────

function periodNav(label, onPrev, onNext, onToday, isToday, exportFn) {
  return `
    <div class="period-nav">
      <div class="period-nav__center">
        <button class="period-nav__btn" id="prevPeriodBtn">‹</button>
        <div class="period-nav__label">${label}</div>
        <button class="period-nav__btn" id="nextPeriodBtn">›</button>
      </div>
      <div class="period-nav__right">
        ${!isToday ? `<button class="period-nav__today" id="todayBtn">↩ Current</button>` : ''}
        <button class="btn btn--secondary btn--sm" id="exportReportBtn">⬇️ Export CSV</button>
      </div>
    </div>`;
}

function attachNavEvents(onPrev, onNext, onToday, exportFn) {
  document.getElementById('prevPeriodBtn')?.addEventListener('click', onPrev);
  document.getElementById('nextPeriodBtn')?.addEventListener('click', onNext);
  document.getElementById('todayBtn')?.addEventListener('click', onToday);
  document.getElementById('exportReportBtn')?.addEventListener('click', exportFn);
}

// ─── Shared: Summary Row ──────────────────────────────────────────────────────

function summaryHTML(transactions) {
  const { income, expenses, balance } = TransactionDB.getSummary(transactions);
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(0) : 0;
  const count = transactions.length;

  return `
    <div class="report-summary">
      <div class="stat-card stat-card--income">
        <div class="stat-card__label">Income</div>
        <div class="stat-card__value">${formatCurrency(income)}</div>
        <div class="stat-card__icon">📈</div>
      </div>
      <div class="stat-card stat-card--expense">
        <div class="stat-card__label">Expenses</div>
        <div class="stat-card__value">${formatCurrency(expenses)}</div>
        <div class="stat-card__icon">📉</div>
      </div>
      <div class="stat-card stat-card--balance">
        <div class="stat-card__label">Net Balance</div>
        <div class="stat-card__value ${balance < 0 ? 'text-expense' : ''}">${formatCurrency(balance)}</div>
        <div class="stat-card__icon">💰</div>
      </div>
      <div class="stat-card stat-card--accounts">
        <div class="stat-card__label">Savings Rate</div>
        <div class="stat-card__value ${savingsRate < 0 ? 'text-expense' : 'text-income'}">${savingsRate}%</div>
        <div class="stat-card__icon">${count} txns</div>
      </div>
    </div>`;
}

// ─── Shared: Category Breakdown ───────────────────────────────────────────────

function categoryBreakdownHTML(transactions, type = 'expense') {
  const filtered = transactions.filter(t => t.type === type);
  const totals   = {};
  filtered.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const sorted  = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, v]) => s + v, 0);

  if (sorted.length === 0) {
    return `<div class="empty-state" style="padding:30px 0">
      <div class="empty-state__icon" style="font-size:32px">🔍</div>
      <div class="empty-state__desc">No ${type} transactions in this period</div>
    </div>`;
  }

  const rows = sorted.map(([cat, amt]) => {
    const pct   = grandTotal > 0 ? (amt / grandTotal * 100) : 0;
    const color = CATEGORY_COLORS[cat] || '#6366f1';
    const icon  = CATEGORY_ICONS[cat]  || '📦';
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center">
            <div class="breakdown-row__icon" style="background:${color}22">${icon}</div>
            <div>
              <div class="breakdown-row__name">${cat}</div>
              <div class="breakdown-row__pct">${pct.toFixed(1)}%</div>
            </div>
          </div>
        </td>
        <td class="breakdown-row__bar-cell">
          <div class="breakdown-row__bar">
            <div class="breakdown-row__bar-fill"
              style="width:${pct}%;background:${color}">
            </div>
          </div>
        </td>
        <td class="breakdown-row__amount" style="color:${type === 'expense' ? 'var(--expense)' : 'var(--income)'}">
          ${formatCurrency(amt)}
        </td>
      </tr>`;
  }).join('');

  return `
    <table class="breakdown-table">
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── Shared: Top Transactions ─────────────────────────────────────────────────

function topTransactionsHTML(transactions, n = 5) {
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);

  if (expenses.length === 0) {
    return `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">No expenses in this period</div>`;
  }

  return expenses.map((t, i) => `
    <div class="top-txn-item">
      <div class="top-txn-rank">#${i + 1}</div>
      <div class="top-txn-icon" style="background:var(--expense-dim)">
        ${CATEGORY_ICONS[t.category] || '💸'}
      </div>
      <div class="top-txn-info">
        <div class="top-txn-cat">${t.category}</div>
        <div class="top-txn-date">${t.note ? t.note + ' · ' : ''}${formatDate(t.date)}</div>
      </div>
      <div class="top-txn-amount text-expense">− ${formatCurrency(t.amount)}</div>
    </div>`).join('');
}

// ─── Shared: Smart Insights ───────────────────────────────────────────────────

function insightsHTML(transactions, periodDays) {
  const expenses = transactions.filter(t => t.type === 'expense');
  const income   = transactions.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = income.reduce((s, t) => s + t.amount, 0);

  // Biggest spending category
  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const topCat    = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  // Average daily spend
  const avgDaily  = periodDays > 0 ? totalExp / periodDays : 0;

  // Best (lowest spend) day of week
  const daySpend  = Array(7).fill(0);
  expenses.forEach(t => {
    const d = new Date(t.date + 'T00:00:00').getDay();
    daySpend[d] += t.amount;
  });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxDay   = daySpend.indexOf(Math.max(...daySpend));

  // Savings
  const savings   = totalInc - totalExp;
  const savRate   = totalInc > 0 ? (savings / totalInc * 100).toFixed(0) : 0;

  const cards = [
    {
      icon: topCat ? CATEGORY_ICONS[topCat[0]] || '📦' : '🔍',
      label: 'Top Spending Category',
      value: topCat ? topCat[0] : 'None',
      sub:   topCat ? formatCurrency(topCat[1]) : 'No expenses yet',
    },
    {
      icon: '📅',
      label: 'Avg Daily Spend',
      value: formatCurrency(avgDaily),
      sub:   `Over ${periodDays} day${periodDays !== 1 ? 's' : ''}`,
    },
    {
      icon: '📊',
      label: 'Highest Spend Day',
      value: expenses.length > 0 ? dayNames[maxDay] : '—',
      sub:   expenses.length > 0 ? `${formatCurrency(daySpend[maxDay])} total` : 'No data',
    },
  ];

  return `
    <div class="insights-grid">
      ${cards.map(c => `
        <div class="insight-card">
          <div class="insight-card__icon">${c.icon}</div>
          <div>
            <div class="insight-card__label">${c.label}</div>
            <div class="insight-card__value">${c.value}</div>
            <div class="insight-card__sub">${c.sub}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY REPORT
// ═══════════════════════════════════════════════════════════════

function renderWeekly() {
  const { startDate, endDate } = getWeekRange(state.weekOffset);
  const transactions = TransactionDB.filter({ startDate, endDate });

  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const label = `${formatDateShort(startDate)} – ${formatDateShort(endDate)}, ${start.getFullYear()}`;
  const isCurrentWeek = state.weekOffset === 0;

  const content = document.getElementById('reportContent');
  content.innerHTML = `
    ${periodNav(label, null, null, null, isCurrentWeek)}
    ${summaryHTML(transactions)}
    ${insightsHTML(transactions, 7)}

    <div class="charts-grid charts-grid--2">

      <!-- Day-of-week spending bars -->
      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Daily Breakdown</div>
          <span class="chart-card__badge">${startDate} to ${endDate}</span>
        </div>
        <div id="weekDayBars"></div>
      </div>

      <!-- Income vs Expense donut -->
      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Income vs Expenses</div>
        </div>
        <canvas id="weekPieChart" height="220"></canvas>
      </div>

    </div>

    <div class="charts-grid charts-grid--2">

      <!-- Category breakdown -->
      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Expense Categories</div>
        </div>
        ${categoryBreakdownHTML(transactions, 'expense')}
      </div>

      <!-- Top transactions -->
      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Top Expenses</div>
        </div>
        <div class="top-txn-list">${topTransactionsHTML(transactions, 5)}</div>
      </div>

    </div>`;

  attachNavEvents(
    () => { state.weekOffset--; render(); },
    () => { state.weekOffset++; render(); },
    () => { state.weekOffset = 0; render(); },
    () => exportCSV(transactions, label)
  );

  renderWeekDayBars(startDate, transactions);
  renderWeekPieChart(transactions);
}

function renderWeekDayBars(startDate, transactions) {
  const container = document.getElementById('weekDayBars');
  if (!container) return;

  const dayNames  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const incArr    = Array(7).fill(0);
  const expArr    = Array(7).fill(0);

  transactions.forEach(t => {
    const d    = new Date(t.date + 'T00:00:00');
    const base = new Date(startDate + 'T00:00:00');
    const idx  = Math.round((d - base) / 86400000);
    if (idx >= 0 && idx < 7) {
      if (t.type === 'income')  incArr[idx]  += t.amount;
      else                       expArr[idx] += t.amount;
    }
  });

  const maxVal = Math.max(...incArr, ...expArr, 1);

  container.innerHTML = `
    <div class="weekly-days">
      ${dayNames.map((day, i) => {
        const incH = Math.round((incArr[i] / maxVal) * 72);
        const expH = Math.round((expArr[i] / maxVal) * 72);
        const hasData = incArr[i] > 0 || expArr[i] > 0;
        return `
          <div class="weekly-day">
            <div class="weekly-day__bar-wrap">
              <div class="weekly-day__bar"
                style="height:${incH}px;background:var(--income);opacity:${hasData?1:0.15}"></div>
              <div class="weekly-day__bar"
                style="height:${expH}px;background:var(--expense);opacity:${hasData?1:0.15}"></div>
            </div>
            <div class="weekly-day__label">${day}</div>
            ${hasData ? `<div class="weekly-day__total">${formatCurrency(expArr[i])}</div>` : ''}
          </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;justify-content:center">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
        <div style="width:10px;height:10px;border-radius:2px;background:var(--income)"></div> Income
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
        <div style="width:10px;height:10px;border-radius:2px;background:var(--expense)"></div> Expense
      </div>
    </div>`;
}

function renderWeekPieChart(transactions) {
  const ctx = document.getElementById('weekPieChart')?.getContext('2d');
  if (!ctx) return;
  const { income, expenses } = TransactionDB.getSummary(transactions);

  charts.weekPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income || 0.01, expenses || 0.01],
        backgroundColor: ['rgba(52,211,153,0.8)', 'rgba(248,113,113,0.8)'],
        borderWidth: 2,
        borderColor: 'var(--bg-card)',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b93ab', font: { size: 12, family: 'DM Sans' }, padding: 12 },
        },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY REPORT
// ═══════════════════════════════════════════════════════════════

function renderMonthly() {
  const now   = new Date();
  const d     = new Date(now.getFullYear(), now.getMonth() + state.monthOffset, 1);
  const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const { startDate, endDate } = getMonthRange(monthStr);
  const transactions = TransactionDB.filter({ startDate, endDate });
  const label = getMonthName(monthStr);
  const isCurrentMonth = state.monthOffset === 0;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  const content = document.getElementById('reportContent');
  content.innerHTML = `
    ${periodNav(label, null, null, null, isCurrentMonth)}
    ${summaryHTML(transactions)}
    ${insightsHTML(transactions, daysInMonth)}

    <!-- Main charts row -->
    <div class="charts-grid charts-grid--2">

      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Daily Spending</div>
          <span class="chart-card__badge">${label}</span>
        </div>
        <canvas id="monthDailyChart" height="220"></canvas>
      </div>

      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Expense Categories</div>
        </div>
        <canvas id="monthCatChart" height="220"></canvas>
      </div>

    </div>

    <!-- Breakdown + Top -->
    <div class="charts-grid charts-grid--2">

      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Category Breakdown</div>
        </div>
        ${categoryBreakdownHTML(transactions, 'expense')}
      </div>

      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Top 5 Expenses</div>
        </div>
        <div class="top-txn-list">${topTransactionsHTML(transactions, 5)}</div>
      </div>

    </div>`;

  attachNavEvents(
    () => { state.monthOffset--; render(); },
    () => { state.monthOffset++; render(); },
    () => { state.monthOffset = 0; render(); },
    () => exportCSV(transactions, label)
  );

  renderMonthDailyChart(startDate, endDate, daysInMonth, d, transactions);
  renderMonthCategoryChart(transactions);
}

function renderMonthDailyChart(startDate, endDate, daysInMonth, monthDate, transactions) {
  const ctx = document.getElementById('monthDailyChart')?.getContext('2d');
  if (!ctx) return;

  const expByDay = Array(daysInMonth).fill(0);
  const incByDay = Array(daysInMonth).fill(0);

  transactions.forEach(t => {
    const day = parseInt(t.date.split('-')[2]) - 1;
    if (day >= 0 && day < daysInMonth) {
      if (t.type === 'expense') expByDay[day] += t.amount;
      else                      incByDay[day] += t.amount;
    }
  });

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  charts.monthDaily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incByDay,
          backgroundColor: 'rgba(52,211,153,0.65)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Expenses',
          data: expByDay,
          backgroundColor: 'rgba(248,113,113,0.65)',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#8b93ab', font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 10 },
        },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
      },
      scales: {
        x: {
          ticks: { color: '#555e78', font: { size: 10 }, maxTicksLimit: 10 },
          grid: { color: '#2a2f42' },
        },
        y: {
          ticks: {
            color: '#555e78', font: { size: 10 },
            callback: v => `${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: '#2a2f42' },
        },
      },
    },
  });
}

function renderMonthCategoryChart(transactions) {
  const ctx = document.getElementById('monthCatChart')?.getContext('2d');
  if (!ctx) return;

  const expenses = transactions.filter(t => t.type === 'expense');
  const totals   = {};
  expenses.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const sorted  = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const labels  = sorted.map(([k]) => k);
  const data    = sorted.map(([, v]) => v);
  const colors  = labels.map(l => CATEGORY_COLORS[l] || '#6366f1');

  if (labels.length === 0) {
    ctx.canvas.parentElement.innerHTML += '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:30px 0">No expenses this month</p>';
    return;
  }

  charts.monthCat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'var(--bg-card)',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b93ab', font: { size: 11, family: 'DM Sans' }, padding: 10, boxWidth: 10 },
        },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// YEARLY REPORT
// ═══════════════════════════════════════════════════════════════

function renderYearly() {
  const year = new Date().getFullYear() + state.yearOffset;
  const { startDate, endDate } = getYearRange(year);
  const transactions = TransactionDB.filter({ startDate, endDate });
  const label = `Year ${year}`;
  const isCurrentYear = state.yearOffset === 0;

  const content = document.getElementById('reportContent');
  content.innerHTML = `
    ${periodNav(label, null, null, null, isCurrentYear)}
    ${summaryHTML(transactions)}
    ${insightsHTML(transactions, 365)}

    <!-- Monthly trend -->
    <div class="chart-card" style="margin-bottom:20px">
      <div class="chart-card__header">
        <div class="chart-card__title">Monthly Income vs Expenses — ${year}</div>
      </div>
      <canvas id="yearTrendChart" height="200"></canvas>
    </div>

    <div class="charts-grid charts-grid--2">

      <!-- Category donut -->
      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Yearly Expense Breakdown</div>
        </div>
        <canvas id="yearCatChart" height="260"></canvas>
      </div>

      <!-- Category table -->
      <div class="chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">Category Totals</div>
        </div>
        ${categoryBreakdownHTML(transactions, 'expense')}
      </div>

    </div>

    <!-- Top transactions -->
    <div class="chart-card" style="margin-top:20px">
      <div class="chart-card__header">
        <div class="chart-card__title">Top 5 Biggest Expenses of ${year}</div>
      </div>
      <div class="top-txn-list">${topTransactionsHTML(transactions, 5)}</div>
    </div>`;

  attachNavEvents(
    () => { state.yearOffset--; render(); },
    () => { state.yearOffset++; render(); },
    () => { state.yearOffset = 0; render(); },
    () => exportCSV(transactions, label)
  );

  renderYearTrendChart(year);
  renderYearCategoryChart(transactions);
}

function renderYearTrendChart(year) {
  const ctx = document.getElementById('yearTrendChart')?.getContext('2d');
  if (!ctx) return;

  const months     = [];
  const incomeData = [];
  const expData    = [];
  const balData    = [];

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    const { startDate, endDate } = getMonthRange(monthStr);
    const txns = TransactionDB.filter({ startDate, endDate });
    const { income, expenses, balance } = TransactionDB.getSummary(txns);
    months.push(new Date(year, m - 1, 1).toLocaleDateString('en-PK', { month: 'short' }));
    incomeData.push(income);
    expData.push(expenses);
    balData.push(balance);
  }

  charts.yearTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'rgba(52,211,153,0.7)',
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          label: 'Expenses',
          data: expData,
          backgroundColor: 'rgba(248,113,113,0.7)',
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          label: 'Net Balance',
          data: balData,
          type: 'line',
          borderColor: '#7c6ff7',
          backgroundColor: 'rgba(124,111,247,0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#7c6ff7',
          pointRadius: 4,
          fill: false,
          tension: 0.35,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#8b93ab', font: { size: 12, family: 'DM Sans' }, boxWidth: 12, padding: 12 },
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } },
      },
      scales: {
        x: { ticks: { color: '#8b93ab' }, grid: { color: '#2a2f42' } },
        y: {
          ticks: {
            color: '#8b93ab',
            callback: v => `Rs.${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: '#2a2f42' },
        },
      },
    },
  });
}

function renderYearCategoryChart(transactions) {
  const ctx = document.getElementById('yearCatChart')?.getContext('2d');
  if (!ctx) return;

  const expenses = transactions.filter(t => t.type === 'expense');
  const totals   = {};
  expenses.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => v);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#6366f1');

  if (labels.length === 0) {
    ctx.canvas.parentElement.innerHTML += '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:30px 0">No expenses this year</p>';
    return;
  }

  charts.yearCat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'var(--bg-card)',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b93ab', font: { size: 11, family: 'DM Sans' }, padding: 10, boxWidth: 10 },
        },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
      },
    },
  });
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(transactions, periodLabel) {
  const headers = ['Date', 'Type', 'Category', 'Amount (Rs.)', 'Note'];
  const rows = transactions
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(t => [
      t.date,
      t.type,
      t.category,
      t.amount,
      `"${(t.note || '').replace(/"/g, '""')}"`,
    ]);

  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `report_${periodLabel.replace(/[^a-z0-9]/gi, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported! ⬇️', 'success');
}
