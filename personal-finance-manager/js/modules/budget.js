/**
 * budget.js — Full CRUD Budget Module
 * Personal Finance Manager
 *
 * Features:
 *  - Month navigator (prev / next / back to current)
 *  - Overview stats: total budgeted, total spent, remaining, categories count
 *  - Budget cards with animated progress bars (green→yellow→red)
 *  - Donut ring chart showing overall budget health
 *  - Unbudgeted categories sidebar (expenses with no budget set)
 *  - Add budget: category + limit + month
 *  - Edit budget limit
 *  - Delete budget
 *  - Duplicate budgets to next month
 */

import { BudgetDB, TransactionDB, seedDemoData } from '../db.js';
import {
  formatCurrency, getCurrentMonth, getMonthName, getMonthRange,
  EXPENSE_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS,
  percentageColor, showToast,
} from '../utils/helpers.js';
import { validate, rules, clearAllErrors, applyErrors } from '../utils/validator.js';

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  currentMonth: getCurrentMonth(),   // 'YYYY-MM'
  editingId: null,
  prefillCategory: null,             // for "Set Budget" from unbudgeted panel
};

let ringChart = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  buildShell();
  render();
  initAddButton();
});

// ─── Shell ────────────────────────────────────────────────────────────────────

function buildShell() {
  const root = document.getElementById('budgetRoot');
  if (!root) return;
  root.innerHTML = `
    <div id="monthBarContainer"></div>
    <div id="overviewContainer"></div>
    <div class="budget-layout">
      <div id="budgetCardsContainer"></div>
      <div class="budget-sidebar" id="budgetSidebar"></div>
    </div>`;
}

// ─── Full Re-render ───────────────────────────────────────────────────────────

function render() {
  renderMonthBar();
  renderOverview();
  renderBudgetCards();
  renderSidebar();
}

// ─── Month Bar ────────────────────────────────────────────────────────────────

function renderMonthBar() {
  const container = document.getElementById('monthBarContainer');
  if (!container) return;

  const isCurrentMonth = state.currentMonth === getCurrentMonth();

  container.innerHTML = `
    <div class="month-bar">
      <div class="month-bar__nav">
        <button class="month-bar__btn" id="prevMonthBtn" title="Previous month">‹</button>
        <div class="month-bar__label">${getMonthName(state.currentMonth)}</div>
        <button class="month-bar__btn" id="nextMonthBtn" title="Next month">›</button>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        ${!isCurrentMonth
          ? `<span class="month-bar__today" id="goTodayBtn">↩ This Month</span>`
          : `<span style="font-size:12px;color:var(--text-muted);font-weight:500">Current month</span>`}
        <button class="btn btn--secondary btn--sm" id="copyBudgetsBtn" title="Copy all budgets to next month">
          📋 Copy to Next Month
        </button>
      </div>
    </div>`;

  document.getElementById('prevMonthBtn').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonthBtn').addEventListener('click', () => shiftMonth(+1));
  document.getElementById('goTodayBtn')?.addEventListener('click', () => {
    state.currentMonth = getCurrentMonth();
    render();
  });
  document.getElementById('copyBudgetsBtn').addEventListener('click', copyToNextMonth);
}

function shiftMonth(delta) {
  const [year, mon] = state.currentMonth.split('-').map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  state.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

// ─── Overview Stats ───────────────────────────────────────────────────────────

function renderOverview() {
  const container = document.getElementById('overviewContainer');
  if (!container) return;

  const budgets = BudgetDB.getBudgetsWithSpending(state.currentMonth);
  const totalLimit   = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent   = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemain  = totalLimit - totalSpent;
  const overCount    = budgets.filter(b => b.percentage >= 100).length;
  const overallPct   = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;

  container.innerHTML = `
    <div class="budget-overview">
      <div class="stat-card stat-card--balance">
        <div class="stat-card__label">Total Budgeted</div>
        <div class="stat-card__value">${formatCurrency(totalLimit)}</div>
        <div class="stat-card__icon">🎯</div>
      </div>
      <div class="stat-card stat-card--expense">
        <div class="stat-card__label">Total Spent</div>
        <div class="stat-card__value">${formatCurrency(totalSpent)}</div>
        <div class="stat-card__icon">📉</div>
      </div>
      <div class="stat-card ${totalRemain >= 0 ? 'stat-card--income' : 'stat-card--expense'}">
        <div class="stat-card__label">Remaining</div>
        <div class="stat-card__value ${totalRemain < 0 ? 'text-expense' : ''}">${formatCurrency(Math.abs(totalRemain))}${totalRemain < 0 ? ' over' : ''}</div>
        <div class="stat-card__icon">${totalRemain >= 0 ? '✅' : '⚠️'}</div>
      </div>
      <div class="stat-card stat-card--accounts">
        <div class="stat-card__label">Categories Set</div>
        <div class="stat-card__value">${budgets.length} <span style="font-size:14px;color:var(--text-muted)">/ ${EXPENSE_CATEGORIES.length}</span></div>
        <div class="stat-card__icon">${overCount > 0 ? '🔴' : '📊'}</div>
      </div>
    </div>`;
}

// ─── Budget Cards ─────────────────────────────────────────────────────────────

function renderBudgetCards() {
  const container = document.getElementById('budgetCardsContainer');
  if (!container) return;

  const budgets = BudgetDB.getBudgetsWithSpending(state.currentMonth);

  if (budgets.length === 0) {
    container.innerHTML = `
      <div class="budget-empty">
        <div class="empty-state__icon">🎯</div>
        <div class="empty-state__title" style="font-family:var(--font-display);font-size:18px;color:var(--text-secondary);margin-bottom:8px">No budgets set for ${getMonthName(state.currentMonth)}</div>
        <div class="empty-state__desc" style="margin-bottom:20px">Set spending limits per category to track where your money goes</div>
        <button class="btn btn--primary" id="emptyAddBudgetBtn">+ Set First Budget</button>
      </div>`;
    document.getElementById('emptyAddBudgetBtn')?.addEventListener('click', () => openFormModal(null));
    return;
  }

  // Sort: over-budget first, then by percentage desc
  const sorted = [...budgets].sort((a, b) => b.percentage - a.percentage);

  container.innerHTML = `
    <div class="budget-cards" id="budgetCardsList">
      ${sorted.map(b => budgetCard(b)).join('')}
    </div>`;

  // Attach edit/delete via delegation
  container.querySelectorAll('[data-edit-budget]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openFormModal(btn.dataset.editBudget); });
  });
  container.querySelectorAll('[data-delete-budget]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openDeleteModal(btn.dataset.deleteBudget); });
  });

  // Animate progress bars after render
  requestAnimationFrame(() => {
    container.querySelectorAll('.budget-progress__fill').forEach(el => {
      el.style.width = el.dataset.width + '%';
    });
  });
}

function budgetCard(b) {
  const color     = CATEGORY_COLORS[b.category] || '#6366f1';
  const icon      = CATEGORY_ICONS[b.category]  || '📦';
  const pct       = Math.min(b.percentage, 100);
  const barColor  = percentageColor(b.percentage);
  const isOver    = b.percentage >= 100;
  const isWarning = b.percentage >= 80 && !isOver;

  let statusLabel = 'On Track';
  let statusClass = 'ok';
  if (isOver)    { statusLabel = '⚠️ Over Budget'; statusClass = 'over'; }
  else if (isWarning) { statusLabel = '⚡ Near Limit';  statusClass = 'warning'; }

  return `
    <div class="budget-card ${isOver ? 'budget-card--over' : isWarning ? 'budget-card--warning' : ''}">

      <div class="budget-card__actions">
        <button class="btn btn--secondary btn--sm btn--icon" data-edit-budget="${b.id}" title="Edit">✏️</button>
        <button class="btn btn--danger btn--sm btn--icon" data-delete-budget="${b.id}" title="Delete">🗑️</button>
      </div>

      <div class="budget-card__top">
        <div class="budget-card__left">
          <div class="budget-card__icon" style="background:${color}22;border:1px solid ${color}44">${icon}</div>
          <div class="budget-card__name">${b.category}</div>
        </div>
        <span class="budget-card__status budget-card__status--${statusClass}">${statusLabel}</span>
      </div>

      <div class="budget-card__amounts">
        <div class="budget-card__spent">${formatCurrency(b.spent)}</div>
        <div class="budget-card__limit">of <span>${formatCurrency(b.limit)}</span></div>
      </div>

      <div class="budget-progress">
        <div class="budget-progress__fill"
          style="background:${barColor};width:0%"
          data-width="${pct}">
        </div>
      </div>

      <div class="budget-card__footer">
        <div class="budget-card__remaining" style="color:${barColor}">
          ${isOver
            ? `${formatCurrency(Math.abs(b.remaining))} over budget`
            : `${formatCurrency(b.remaining)} remaining`}
        </div>
        <div class="budget-card__pct">${b.percentage.toFixed(0)}%</div>
      </div>

    </div>`;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function renderSidebar() {
  const container = document.getElementById('budgetSidebar');
  if (!container) return;

  container.innerHTML = `
    <div id="ringCardContainer"></div>
    <div id="unbudgetedContainer"></div>`;

  renderRingChart();
  renderUnbudgeted();
}

// ─── Donut Ring Chart ─────────────────────────────────────────────────────────

function renderRingChart() {
  const container = document.getElementById('ringCardContainer');
  if (!container) return;

  const budgets   = BudgetDB.getBudgetsWithSpending(state.currentMonth);
  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const ringColor  = percentageColor(overallPct);

  container.innerHTML = `
    <div class="budget-ring-card card">
      <div class="card__title">Budget Health</div>
      <div class="budget-ring-canvas-wrap">
        <canvas id="budgetRingChart"></canvas>
        <div class="budget-ring-center">
          <div class="budget-ring-center__pct" style="color:${ringColor}">${overallPct}%</div>
          <div class="budget-ring-center__label">spent</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-top:4px">
        ${formatCurrency(totalSpent)} of ${formatCurrency(totalLimit)}
      </div>
      ${budgets.length === 0
        ? `<div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:12px">Set budgets to see your health score</div>`
        : ''}
    </div>`;

  if (budgets.length === 0) return;

  const ctx = document.getElementById('budgetRingChart').getContext('2d');
  if (ringChart) ringChart.destroy();

  const labels  = budgets.map(b => b.category);
  const data    = budgets.map(b => b.spent > 0 ? b.spent : 0.01);
  const colors  = budgets.map(b => CATEGORY_COLORS[b.category] || '#6366f1');

  ringChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'var(--bg-card)',
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });
}

// ─── Unbudgeted Categories ────────────────────────────────────────────────────

function renderUnbudgeted() {
  const container = document.getElementById('unbudgetedContainer');
  if (!container) return;

  const { startDate, endDate } = getMonthRange(state.currentMonth);
  const expenses  = TransactionDB.filter({ type: 'expense', startDate, endDate });
  const budgets   = BudgetDB.getAll().filter(b => b.month === state.currentMonth);
  const budgetedCats = new Set(budgets.map(b => b.category));

  // Aggregate unbudgeted spending
  const unbudgetedMap = {};
  expenses.forEach(t => {
    if (!budgetedCats.has(t.category)) {
      unbudgetedMap[t.category] = (unbudgetedMap[t.category] || 0) + t.amount;
    }
  });

  const unbudgetedList = Object.entries(unbudgetedMap)
    .sort((a, b) => b[1] - a[1]);

  container.innerHTML = `
    <div class="unbudgeted-card card">
      <div class="card__title">Unbudgeted Spending</div>
      ${unbudgetedList.length === 0
        ? `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px">
            ${budgetedCats.size > 0
              ? '✅ All spending categories have budgets!'
              : 'No expenses recorded this month'}
           </div>`
        : unbudgetedList.map(([cat, spent]) => `
            <div class="unbudgeted-item">
              <div class="unbudgeted-item__left">
                <div class="unbudgeted-item__icon"
                  style="background:${CATEGORY_COLORS[cat]}22">
                  ${CATEGORY_ICONS[cat] || '📦'}
                </div>
                <div class="unbudgeted-item__name">${cat}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="unbudgeted-item__spent">${formatCurrency(spent)}</div>
                <span class="unbudgeted-item__add" data-set-budget="${cat}">+ Budget</span>
              </div>
            </div>`).join('')}
    </div>`;

  // "Set Budget" quick-links from unbudgeted panel
  container.querySelectorAll('[data-set-budget]').forEach(el => {
    el.addEventListener('click', () => {
      state.prefillCategory = el.dataset.setBudget;
      openFormModal(null);
    });
  });
}

// ─── Add Button ───────────────────────────────────────────────────────────────

function initAddButton() {
  document.getElementById('addBudgetBtn')?.addEventListener('click', () => openFormModal(null));
}

// ─── FORM MODAL ───────────────────────────────────────────────────────────────

function openFormModal(id) {
  state.editingId = id || null;
  const isEdit  = !!id;
  const budget  = isEdit ? BudgetDB.getById(id) : null;

  // Figure out which categories already have budgets this month
  const existing = document.getElementById('budgetFormOverlay');
  if (existing) existing.remove();

  const alreadySet = new Set(
    BudgetDB.getAll()
      .filter(b => b.month === state.currentMonth && b.id !== id)
      .map(b => b.category)
  );

  const prefill = state.prefillCategory;
  state.prefillCategory = null;

  const catOptions = EXPENSE_CATEGORIES.map(c => {
    const disabled = alreadySet.has(c) && !isEdit;
    const selected = (budget?.category === c) || (prefill === c && !isEdit);
    return `<option value="${c}" ${disabled ? 'disabled' : ''} ${selected ? 'selected' : ''}>
      ${CATEGORY_ICONS[c] || ''} ${c}${disabled ? ' (already set)' : ''}
    </option>`;
  }).join('');

  const html = `
    <div class="modal-overlay" id="budgetFormOverlay">
      <div class="modal" style="max-width:440px">
        <div class="modal__header">
          <span class="modal__title">${isEdit ? 'Edit Budget' : 'Set Budget'}</span>
          <button class="modal__close" id="closeBudgetForm">✕</button>
        </div>
        <div class="modal__body">

          <div style="background:var(--bg-elevated);border:1px solid var(--border);
            border-radius:var(--radius-md);padding:10px 14px;margin-bottom:18px;
            font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:8px">
            📅 <span>Setting budget for <strong style="color:var(--text-primary)">${getMonthName(state.currentMonth)}</strong></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="budgetCategory">Category <span>*</span></label>
            <select class="form-select" id="budgetCategory" ${isEdit ? 'disabled' : ''}>
              ${catOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="budgetLimit">Monthly Limit (Rs.) <span>*</span></label>
            <input type="number" class="form-input" id="budgetLimit"
              placeholder="e.g. 5000"
              value="${budget?.limit || ''}" min="1" step="1" />
          </div>

          <!-- Spending hint for edit mode -->
          ${isEdit && budget ? `
            <div style="background:var(--bg-elevated);border-radius:var(--radius-md);
              padding:12px 14px;font-size:13px;color:var(--text-secondary)">
              💡 You've already spent
              <strong style="color:var(--expense)">${formatCurrency(
                BudgetDB.getBudgetsWithSpending(state.currentMonth)
                  .find(b => b.id === id)?.spent || 0
              )}</strong>
              this month on ${budget.category}.
            </div>` : ''}

        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" id="cancelBudgetForm">Cancel</button>
          <button class="btn btn--primary" id="saveBudgetForm">
            ${isEdit ? '💾 Update Budget' : '✅ Set Budget'}
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('closeBudgetForm').addEventListener('click', closeFormModal);
  document.getElementById('cancelBudgetForm').addEventListener('click', closeFormModal);
  document.getElementById('saveBudgetForm').addEventListener('click', saveForm);
  document.getElementById('budgetFormOverlay').addEventListener('click', e => {
    if (e.target.id === 'budgetFormOverlay') closeFormModal();
  });

  requestAnimationFrame(() =>
    document.getElementById('budgetFormOverlay').classList.add('active')
  );
}

function closeFormModal() {
  const modal = document.getElementById('budgetFormOverlay');
  if (modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 350); }
  state.editingId = null;
}

function saveForm() {
  const modal = document.getElementById('budgetFormOverlay');
  clearAllErrors(modal);

  const data = {
    category: document.getElementById('budgetCategory').value,
    limit:    document.getElementById('budgetLimit').value,
    month:    state.currentMonth,
  };

  const { valid, errors } = validate(data, {
    category: [rules.required],
    limit:    [rules.required, rules.positiveNumber],
  });

  if (!valid) { applyErrors(errors); return; }

  if (state.editingId) {
    BudgetDB.update(state.editingId, { limit: parseFloat(data.limit) });
    showToast('Budget updated! ✏️', 'success');
  } else {
    BudgetDB.create(data);
    showToast(`Budget set for ${data.category}! 🎯`, 'success');
  }

  closeFormModal();
  render();
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────

function openDeleteModal(id) {
  const budget  = BudgetDB.getById(id);
  if (!budget) return;

  const existing = document.getElementById('budgetDeleteOverlay');
  if (existing) existing.remove();

  const spending = BudgetDB.getBudgetsWithSpending(state.currentMonth).find(b => b.id === id);

  const html = `
    <div class="modal-overlay" id="budgetDeleteOverlay">
      <div class="modal" style="max-width:400px">
        <div class="modal__header">
          <span class="modal__title">Remove Budget</span>
          <button class="modal__close" id="cancelBudgetDel">✕</button>
        </div>
        <div class="modal__body" style="text-align:center;padding:28px 24px">
          <div style="font-size:44px;margin-bottom:12px">${CATEGORY_ICONS[budget.category] || '🎯'}</div>
          <div style="font-family:var(--font-display);font-size:17px;font-weight:700;
            color:var(--text-primary);margin-bottom:8px">
            Remove ${budget.category} budget?
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6">
            The <strong>${formatCurrency(budget.limit)}</strong> budget for
            <strong>${getMonthName(budget.month)}</strong> will be deleted.
            ${spending?.spent > 0 ? `<br/>You've already spent <strong style="color:var(--expense)">${formatCurrency(spending.spent)}</strong> in this category.` : ''}
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" id="cancelBudgetDel2">Cancel</button>
          <button class="btn btn--danger" id="confirmBudgetDel" data-id="${id}">🗑️ Remove</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('cancelBudgetDel').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelBudgetDel2').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmBudgetDel').addEventListener('click', () => executeDelete(id));
  document.getElementById('budgetDeleteOverlay').addEventListener('click', e => {
    if (e.target.id === 'budgetDeleteOverlay') closeDeleteModal();
  });

  requestAnimationFrame(() =>
    document.getElementById('budgetDeleteOverlay').classList.add('active')
  );
}

function closeDeleteModal() {
  const modal = document.getElementById('budgetDeleteOverlay');
  if (modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 350); }
}

function executeDelete(id) {
  BudgetDB.delete(id);
  closeDeleteModal();
  showToast('Budget removed.', 'info');
  render();
}

// ─── Copy Budgets to Next Month ───────────────────────────────────────────────

function copyToNextMonth() {
  const budgets = BudgetDB.getAll().filter(b => b.month === state.currentMonth);
  if (budgets.length === 0) {
    showToast('No budgets to copy this month.', 'warning');
    return;
  }

  // Calculate next month string
  const [year, mon] = state.currentMonth.split('-').map(Number);
  const d = new Date(year, mon, 1);
  const nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Check which categories are already set for next month
  const alreadyNext = new Set(
    BudgetDB.getAll().filter(b => b.month === nextMonth).map(b => b.category)
  );

  let copied = 0;
  budgets.forEach(b => {
    if (!alreadyNext.has(b.category)) {
      BudgetDB.create({ category: b.category, limit: b.limit, month: nextMonth });
      copied++;
    }
  });

  if (copied === 0) {
    showToast(`All budgets already exist for ${getMonthName(nextMonth)}.`, 'info');
  } else {
    showToast(`Copied ${copied} budget${copied > 1 ? 's' : ''} to ${getMonthName(nextMonth)}! 📋`, 'success');
    // Navigate to next month to show result
    state.currentMonth = nextMonth;
    render();
  }
}

// getMonthRange is imported from ../utils/helpers.js
