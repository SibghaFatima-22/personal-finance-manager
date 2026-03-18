/**
 * dashboard.js — Dashboard Page Module
 * Personal Finance Manager
 */

import { TransactionDB, AccountDB, SettingsDB, seedDemoData } from '../db.js';
import {
  formatCurrency, formatDateShort, getTodayString,
  getCurrentMonth, getMonthRange, getMonthName,
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS,
  showToast,
} from '../utils/helpers.js';
import { validate, rules, clearAllErrors, applyErrors } from '../utils/validator.js';

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  renderGreeting();
  renderStats();
  renderCharts();
  renderRecentTransactions();
  initQuickAdd();
  initThemeToggle();
  renderSidebarUser();
});

// ─── Greeting ─────────────────────────────────────────────────────────────────

function renderGreeting() {
  const hour = new Date().getHours();
  const emoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const word  = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const settings = SettingsDB.get();

  document.getElementById('dashGreeting').textContent =
    `Good ${word}, ${settings.userName} ${emoji}`;
  document.getElementById('dashDate').textContent =
    new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function renderStats() {
  const { startDate, endDate } = getMonthRange(getCurrentMonth());
  const monthTxns = TransactionDB.filter({ startDate, endDate });
  const { income, expenses, balance } = TransactionDB.getSummary(monthTxns);
  const allTxns = TransactionDB.getAll();
  const { balance: totalBalance } = TransactionDB.getSummary(allTxns);
  const accounts = AccountDB.getAll();

  document.getElementById('statBalance').textContent = formatCurrency(totalBalance);
  document.getElementById('statIncome').textContent = formatCurrency(income);
  document.getElementById('statExpenses').textContent = formatCurrency(expenses);
  document.getElementById('statAccounts').textContent = accounts.length;
}

// ─── Charts ───────────────────────────────────────────────────────────────────

let categoryChart = null;
let trendChart = null;

function renderCharts() {
  renderCategoryChart();
  renderTrendChart();
}

function renderCategoryChart() {
  const { startDate, endDate } = getMonthRange(getCurrentMonth());
  document.getElementById('chartMonthLabel').textContent = getMonthName(getCurrentMonth());

  const expenses = TransactionDB.filter({ type: 'expense', startDate, endDate });
  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#6366f1');

  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChart) categoryChart.destroy();

  if (labels.length === 0) {
    ctx.canvas.parentElement.innerHTML += '<p class="text-muted text-sm" style="text-align:center;padding:40px 0">No expenses this month</p>';
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#181c27', hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b93ab', font: { size: 12, family: 'DM Sans' }, padding: 12, boxWidth: 12, borderRadius: 3 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });
}

function renderTrendChart() {
  const months = [];
  const incomeData = [];
  const expenseData = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(d.toLocaleDateString('en-PK', { month: 'short' }));
    const { startDate, endDate } = getMonthRange(monthStr);
    const txns = TransactionDB.filter({ startDate, endDate });
    const { income, expenses } = TransactionDB.getSummary(txns);
    incomeData.push(income);
    expenseData.push(expenses);
  }

  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
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
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: 'rgba(248,113,113,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#8b93ab', font: { size: 12, family: 'DM Sans' }, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` },
        },
      },
      scales: {
        x: { ticks: { color: '#8b93ab', font: { size: 12 } }, grid: { color: '#2a2f42' } },
        y: {
          ticks: {
            color: '#8b93ab', font: { size: 11 },
            callback: v => `Rs.${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: '#2a2f42' },
        },
      },
    },
  });
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

function renderRecentTransactions() {
  const container = document.getElementById('recentTransactionsList');
  const transactions = TransactionDB.getAll()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">💳</div>
        <div class="empty-state__title">No transactions yet</div>
        <div class="empty-state__desc">Click "Add Transaction" to get started</div>
      </div>`;
    return;
  }

  container.innerHTML = transactions.map(t => {
    const icon = CATEGORY_ICONS[t.category] || '💸';
    const isIncome = t.type === 'income';
    return `
      <div class="txn-item">
        <div class="txn-item__icon txn-item__icon--${t.type}">${icon}</div>
        <div class="txn-item__info">
          <div class="txn-item__category">${t.category}</div>
          <div class="txn-item__meta">${t.note || t.type} · ${formatDateShort(t.date)}</div>
        </div>
        <div class="txn-item__amount txn-item__amount--${t.type}">
          ${isIncome ? '+' : '-'} ${formatCurrency(t.amount)}
        </div>
      </div>`;
  }).join('');
}

// ─── Quick Add Modal ──────────────────────────────────────────────────────────

let currentType = 'expense';

function initQuickAdd() {
  const modal = document.getElementById('quickAddModal');
  const openBtn = document.getElementById('quickAddBtn');
  const closeBtn = document.getElementById('closeQuickAdd');
  const cancelBtn = document.getElementById('cancelQuickAdd');
  const saveBtn = document.getElementById('saveQuickAdd');
  const toggleExpense = document.getElementById('toggleExpense');
  const toggleIncome = document.getElementById('toggleIncome');

  openBtn.addEventListener('click', () => openModal());
  closeBtn.addEventListener('click', () => closeModal());
  cancelBtn.addEventListener('click', () => closeModal());
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  toggleExpense.addEventListener('click', () => setType('expense'));
  toggleIncome.addEventListener('click', () => setType('income'));

  saveBtn.addEventListener('click', saveTransaction);

  // Default date = today
  document.getElementById('qaDate').value = getTodayString();
}

function openModal() {
  populateSelects();
  document.getElementById('quickAddModal').classList.add('active');
}

function closeModal() {
  document.getElementById('quickAddModal').classList.remove('active');
  resetForm();
}

function setType(type) {
  currentType = type;
  document.getElementById('toggleExpense').classList.toggle('active', type === 'expense');
  document.getElementById('toggleIncome').classList.toggle('active', type === 'income');
  populateCategorySelect();
}

function populateSelects() {
  populateCategorySelect();
  populateAccountSelect();
}

function populateCategorySelect() {
  const sel = document.getElementById('qaCategory');
  const cats = currentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  sel.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_ICONS[c] || ''} ${c}</option>`).join('');
}

function populateAccountSelect() {
  const sel = document.getElementById('qaAccount');
  const accounts = AccountDB.getAll();
  if (accounts.length === 0) {
    sel.innerHTML = '<option value="">No accounts — add one first</option>';
    return;
  }
  sel.innerHTML = accounts.map(a => `<option value="${a.id}">${a.icon} ${a.name}</option>`).join('');
}

function saveTransaction() {
  const form = document.getElementById('quickAddModal');
  clearAllErrors(form);

  const data = {
    type: currentType,
    amount: document.getElementById('qaAmount').value,
    category: document.getElementById('qaCategory').value,
    accountId: document.getElementById('qaAccount').value,
    date: document.getElementById('qaDate').value,
    note: document.getElementById('qaNote').value,
  };

  const { valid, errors } = validate(data, {
    amount: [rules.required, rules.positiveNumber],
    category: [rules.required],
    accountId: [rules.required],
    date: [rules.required, rules.validDate],
  });

  if (!valid) {
    applyErrors(errors);
    return;
  }

  TransactionDB.create(data);
  closeModal();
  showToast('Transaction added! 🎉', 'success');

  // Refresh dashboard
  renderStats();
  renderCharts();
  renderRecentTransactions();
}

function resetForm() {
  ['qaAmount', 'qaNote'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('qaDate').value = getTodayString();
  setType('expense');
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function initThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  const settings = SettingsDB.get();
  updateThemeBtn(settings.theme);

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    SettingsDB.update({ theme: next });
    updateThemeBtn(next);
  });
}

function updateThemeBtn(theme) {
  const btn = document.getElementById('themeToggleBtn');
  btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

// ─── Sidebar User ─────────────────────────────────────────────────────────────

function renderSidebarUser() {
  const settings = SettingsDB.get();
  document.getElementById('sidebarName').textContent = settings.userName || 'User';
  document.getElementById('sidebarAvatar').textContent = (settings.userName || 'U')[0].toUpperCase();
}
