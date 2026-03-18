/**
 * transactions.js — Full CRUD Transactions Module
 * Personal Finance Manager
 *
 * Features:
 *  - List all transactions in a paginated table
 *  - Add new transaction (modal form)
 *  - Edit existing transaction (same modal, pre-filled)
 *  - Delete with confirmation modal
 *  - Search by note/category
 *  - Filter by type, category, account, date range
 *  - Summary stats (income / expense / balance for filtered view)
 *  - Pagination (10 per page)
 *  - Export to CSV
 */

import { TransactionDB, AccountDB, seedDemoData } from '../db.js';
import {
  formatCurrency, formatDate, getTodayString,
  EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  CATEGORY_ICONS,
  showToast,
} from '../utils/helpers.js';
import {
  validate, rules, clearAllErrors, applyErrors,
} from '../utils/validator.js';

// ─── State ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

let state = {
  allTransactions: [],
  filtered: [],
  currentPage: 1,
  editingId: null,
  deleteId: null,
  formType: 'expense',
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  buildPageShell();
  loadTransactions();
  initFormModal();
  initDeleteModal();
  initAddButton();
});

// ─── Page Shell ───────────────────────────────────────────────────────────────

function buildPageShell() {
  const root = document.getElementById('transactionsRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="txn-summary" id="txnSummary"></div>
    <div id="filterBarContainer"></div>
    <div id="tableContainer"></div>`;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function loadTransactions() {
  state.allTransactions = TransactionDB.getAll()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  applyFilters();
}

function applyFilters() {
  const search   = document.getElementById('filterSearch')?.value.toLowerCase() || '';
  const type     = document.getElementById('filterType')?.value || '';
  const category = document.getElementById('filterCategory')?.value || '';
  const account  = document.getElementById('filterAccount')?.value || '';
  const from     = document.getElementById('filterFrom')?.value || '';
  const to       = document.getElementById('filterTo')?.value || '';

  state.filtered = state.allTransactions.filter(t => {
    if (type     && t.type !== type) return false;
    if (category && t.category !== category) return false;
    if (account  && t.accountId !== account) return false;
    if (from     && t.date < from) return false;
    if (to       && t.date > to) return false;
    if (search) {
      const hay = `${t.category} ${t.note || ''} ${t.amount}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  state.currentPage = 1;
  renderSummary();
  renderFilterBar();
  renderTable();
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function renderSummary() {
  const { income, expenses, balance } = TransactionDB.getSummary(state.filtered);
  const container = document.getElementById('txnSummary');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card stat-card--income">
      <div class="stat-card__label">Total Income</div>
      <div class="stat-card__value">${formatCurrency(income)}</div>
      <div class="stat-card__icon">📈</div>
    </div>
    <div class="stat-card stat-card--expense">
      <div class="stat-card__label">Total Expenses</div>
      <div class="stat-card__value">${formatCurrency(expenses)}</div>
      <div class="stat-card__icon">📉</div>
    </div>
    <div class="stat-card stat-card--balance">
      <div class="stat-card__label">Net Balance</div>
      <div class="stat-card__value ${balance >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(balance)}</div>
      <div class="stat-card__icon">💰</div>
    </div>`;
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function renderFilterBar() {
  const container = document.getElementById('filterBarContainer');
  if (!container) return;

  const accounts = AccountDB.getAll();

  // Preserve current filter values
  const prevSearch   = document.getElementById('filterSearch')?.value || '';
  const prevType     = document.getElementById('filterType')?.value || '';
  const prevCategory = document.getElementById('filterCategory')?.value || '';
  const prevAccount  = document.getElementById('filterAccount')?.value || '';
  const prevFrom     = document.getElementById('filterFrom')?.value || '';
  const prevTo       = document.getElementById('filterTo')?.value || '';

  const allCats = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];

  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-bar__search">
        <span class="filter-bar__search-icon">🔍</span>
        <input type="text" class="form-input" id="filterSearch"
          placeholder="Search by category, note..." value="${prevSearch}" />
      </div>
      <div class="filter-bar__selects">
        <select class="form-select" id="filterType">
          <option value="" ${!prevType ? 'selected':''}>All Types</option>
          <option value="income" ${prevType==='income'?'selected':''}>📈 Income</option>
          <option value="expense" ${prevType==='expense'?'selected':''}>📉 Expense</option>
        </select>
        <select class="form-select" id="filterCategory">
          <option value="">All Categories</option>
          ${allCats.map(c =>
            `<option value="${c}" ${prevCategory===c?'selected':''}>${CATEGORY_ICONS[c]||''} ${c}</option>`
          ).join('')}
        </select>
        <select class="form-select" id="filterAccount">
          <option value="">All Accounts</option>
          ${accounts.map(a =>
            `<option value="${a.id}" ${prevAccount===a.id?'selected':''}>${a.icon} ${a.name}</option>`
          ).join('')}
        </select>
        <input type="date" class="form-input" id="filterFrom" value="${prevFrom}"
          title="From date" style="min-width:130px" />
        <input type="date" class="form-input" id="filterTo" value="${prevTo}"
          title="To date" style="min-width:130px" />
      </div>
      <div class="filter-bar__actions">
        <button class="btn btn--ghost btn--sm" id="clearFiltersBtn">✕ Clear</button>
      </div>
    </div>`;

  // Attach filter events
  ['filterSearch','filterType','filterCategory','filterAccount','filterFrom','filterTo']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', applyFilters);
        el.addEventListener('change', applyFilters);
      }
    });

  document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
    ['filterSearch','filterFrom','filterTo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['filterType','filterCategory','filterAccount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    applyFilters();
  });
}

// ─── Table ────────────────────────────────────────────────────────────────────

function renderTable() {
  const container = document.getElementById('tableContainer');
  if (!container) return;

  const totalItems = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  state.currentPage = Math.min(state.currentPage, totalPages);

  const start = (state.currentPage - 1) * PAGE_SIZE;
  const pageItems = state.filtered.slice(start, start + PAGE_SIZE);

  const accounts = AccountDB.getAll();
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  const rows = pageItems.length === 0
    ? `<tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          <div class="empty-state__title">No transactions found</div>
          <div class="empty-state__desc">Try adjusting your filters or add a new transaction</div>
        </div>
       </td></tr>`
    : pageItems.map(t => {
        const acc = accMap[t.accountId];
        const icon = CATEGORY_ICONS[t.category] || '💸';
        const isIncome = t.type === 'income';

        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;border-radius:8px;
                  background:${isIncome ? 'var(--income-dim)' : 'var(--expense-dim)'};
                  display:flex;align-items:center;justify-content:center;
                  font-size:17px;flex-shrink:0">${icon}</div>
                <div>
                  <div style="font-weight:600;font-size:14px;color:var(--text-primary)">${t.category}</div>
                  <div class="note-cell">${t.note || '—'}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge--${t.type}">
                ${isIncome ? '▲ Income' : '▼ Expense'}
              </span>
            </td>
            <td>
              <div class="amount-cell amount-cell--${t.type}">
                ${isIncome ? '+' : '−'}&nbsp;${formatCurrency(t.amount)}
              </div>
            </td>
            <td style="color:var(--text-secondary);font-size:13px;white-space:nowrap">
              ${formatDate(t.date)}
            </td>
            <td>
              ${acc
                ? `<div class="acc-badge">${acc.icon} <span>${acc.name}</span></div>`
                : `<span class="text-muted text-xs">—</span>`}
            </td>
            <td>
              <div class="row-actions">
                <button class="btn btn--secondary btn--sm" data-edit="${t.id}">✏️ Edit</button>
                <button class="btn btn--danger btn--sm" data-delete="${t.id}">🗑️</button>
              </div>
            </td>
          </tr>`;
      }).join('');

  const showingFrom = totalItems === 0 ? 0 : start + 1;
  const showingTo   = Math.min(start + PAGE_SIZE, totalItems);

  container.innerHTML = `
    <div class="txn-table-wrap">
      <div class="txn-table-header">
        <div class="txn-count">
          Showing <span>${showingFrom}–${showingTo}</span> of <span>${totalItems}</span> transactions
        </div>
        <button class="btn btn--secondary btn--sm" id="exportBtn">⬇️ Export CSV</button>
      </div>

      <div style="overflow-x:auto">
        <table class="table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Account</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="pagination">
        <div class="pagination__info">Page ${state.currentPage} of ${totalPages}</div>
        <div class="pagination__btns">${buildPaginationButtons(state.currentPage, totalPages)}</div>
      </div>
    </div>`;

  // Attach table action events via delegation
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openFormModal(btn.dataset.edit));
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.delete));
  });
  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => changePage(parseInt(btn.dataset.page)));
  });

  document.getElementById('exportBtn')?.addEventListener('click', exportCSV);
}

function buildPaginationButtons(current, total) {
  let html = `<button class="pagination__btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>← Prev</button>`;

  for (let i = 1; i <= total; i++) {
    if (total > 7 && i > 2 && i < total - 1 && Math.abs(i - current) > 1) {
      if (i === 3 || i === total - 2) html += `<span style="padding:6px 4px;color:var(--text-muted)">…</span>`;
      continue;
    }
    html += `<button class="pagination__btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  html += `<button class="pagination__btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>Next →</button>`;
  return html;
}

function changePage(page) {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  if (page < 1 || page > totalPages) return;
  state.currentPage = page;
  renderTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Add Button ───────────────────────────────────────────────────────────────

function initAddButton() {
  const btn = document.getElementById('addTxnBtn');
  if (btn) btn.addEventListener('click', () => openFormModal(null));
}

// ─── FORM MODAL ───────────────────────────────────────────────────────────────

function initFormModal() {
  document.addEventListener('click', e => {
    if (e.target.id === 'formModalOverlay') closeFormModal();
  });
}

function openFormModal(id) {
  state.editingId = id || null;
  state.formType = 'expense';

  const existing = document.getElementById('formModalOverlay');
  if (existing) existing.remove();

  const accounts = AccountDB.getAll();
  const accOptions = accounts.length
    ? accounts.map(a => `<option value="${a.id}">${a.icon} ${a.name}</option>`).join('')
    : `<option value="">No accounts — add one first</option>`;

  const html = `
    <div class="modal-overlay" id="formModalOverlay">
      <div class="modal" style="max-width:500px">
        <div class="modal__header">
          <span class="modal__title" id="formModalTitle">${id ? 'Edit' : 'Add'} Transaction</span>
          <button class="modal__close" id="closeFormModal">✕</button>
        </div>
        <div class="modal__body" id="formModalBody">
          <div class="type-toggle" style="margin-bottom:20px">
            <button class="type-toggle__btn active" data-type="expense" id="toggleExpenseBtn">📉 Expense</button>
            <button class="type-toggle__btn" data-type="income" id="toggleIncomeBtn">📈 Income</button>
          </div>
          <div class="form-group">
            <label class="form-label" for="fAmount">Amount <span>*</span></label>
            <input type="number" class="form-input" id="fAmount" placeholder="0.00" min="0.01" step="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label" for="fCategory">Category <span>*</span></label>
            <select class="form-select" id="fCategory"></select>
          </div>
          <div class="grid grid--2" style="gap:12px">
            <div class="form-group mb-0">
              <label class="form-label" for="fAccount">Account <span>*</span></label>
              <select class="form-select" id="fAccount">${accOptions}</select>
            </div>
            <div class="form-group mb-0">
              <label class="form-label" for="fDate">Date <span>*</span></label>
              <input type="date" class="form-input" id="fDate" />
            </div>
          </div>
          <div class="form-group" style="margin-top:14px">
            <label class="form-label" for="fNote">Note</label>
            <input type="text" class="form-input" id="fNote"
              placeholder="What was this for?" maxlength="100" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" id="cancelFormBtn">Cancel</button>
          <button class="btn btn--primary" id="saveFormBtn">
            ${id ? '💾 Update' : '✅ Save Transaction'}
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  // Events
  document.getElementById('closeFormModal').addEventListener('click', closeFormModal);
  document.getElementById('cancelFormBtn').addEventListener('click', closeFormModal);
  document.getElementById('saveFormBtn').addEventListener('click', saveForm);
  document.getElementById('toggleExpenseBtn').addEventListener('click', () => setFormType('expense'));
  document.getElementById('toggleIncomeBtn').addEventListener('click', () => setFormType('income'));

  // Pre-fill for edit
  if (id) {
    const t = TransactionDB.getById(id);
    if (t) {
      setFormType(t.type);
      document.getElementById('fAmount').value   = t.amount;
      document.getElementById('fDate').value     = t.date;
      document.getElementById('fNote').value     = t.note || '';
      populateCategorySelect(t.type, t.category);
      // Set account
      const accSel = document.getElementById('fAccount');
      if (accSel) accSel.value = t.accountId;
    }
  } else {
    document.getElementById('fDate').value = getTodayString();
    populateCategorySelect('expense');
  }

  requestAnimationFrame(() =>
    document.getElementById('formModalOverlay').classList.add('active')
  );
}

function closeFormModal() {
  const modal = document.getElementById('formModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 350);
  }
  state.editingId = null;
}

function setFormType(type) {
  state.formType = type;
  document.getElementById('toggleExpenseBtn')?.classList.toggle('active', type === 'expense');
  document.getElementById('toggleIncomeBtn')?.classList.toggle('active', type === 'income');
  populateCategorySelect(type);
}

function populateCategorySelect(type = state.formType, selected = null) {
  const sel = document.getElementById('fCategory');
  if (!sel) return;
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  sel.innerHTML = cats.map(c =>
    `<option value="${c}" ${c === selected ? 'selected' : ''}>${CATEGORY_ICONS[c] || ''} ${c}</option>`
  ).join('');
}

function saveForm() {
  const modal = document.getElementById('formModalOverlay');
  clearAllErrors(modal);

  const data = {
    type:      state.formType,
    amount:    document.getElementById('fAmount').value,
    category:  document.getElementById('fCategory').value,
    accountId: document.getElementById('fAccount').value,
    date:      document.getElementById('fDate').value,
    note:      document.getElementById('fNote').value.trim(),
  };

  const { valid, errors } = validate(data, {
    amount:    [rules.required, rules.positiveNumber],
    category:  [rules.required],
    accountId: [rules.required],
    date:      [rules.required, rules.validDate],
  });

  if (!valid) { applyErrors(errors); return; }

  if (state.editingId) {
    TransactionDB.update(state.editingId, data);
    showToast('Transaction updated! ✏️', 'success');
  } else {
    TransactionDB.create(data);
    showToast('Transaction added! 🎉', 'success');
  }

  closeFormModal();
  loadTransactions();
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────

function initDeleteModal() {
  document.addEventListener('click', e => {
    if (e.target.id === 'deleteModalOverlay') closeDeleteModal();
  });
}

function openDeleteModal(id) {
  state.deleteId = id;
  const t = TransactionDB.getById(id);
  if (!t) return;

  const existing = document.getElementById('deleteModalOverlay');
  if (existing) existing.remove();

  const html = `
    <div class="modal-overlay" id="deleteModalOverlay">
      <div class="modal delete-modal" style="max-width:400px">
        <div class="modal__header">
          <span class="modal__title">Delete Transaction</span>
          <button class="modal__close" id="cancelDeleteBtn">✕</button>
        </div>
        <div class="modal__body">
          <div class="delete-modal__icon">🗑️</div>
          <div class="delete-modal__title">Are you sure?</div>
          <div class="delete-modal__desc">
            This will permanently delete the <strong>${t.category}</strong> transaction
            of <strong>${formatCurrency(t.amount)}</strong> on ${formatDate(t.date)}.
            <br/><br/>This action <strong>cannot be undone</strong>.
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" id="cancelDeleteBtn2">Cancel</button>
          <button class="btn btn--danger" id="confirmDeleteBtn">🗑️ Delete</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteBtn2').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', executeDelete);

  requestAnimationFrame(() =>
    document.getElementById('deleteModalOverlay').classList.add('active')
  );
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 350);
  }
  state.deleteId = null;
}

function executeDelete() {
  if (!state.deleteId) return;
  TransactionDB.delete(state.deleteId);
  closeDeleteModal();
  showToast('Transaction deleted.', 'info');
  loadTransactions();
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV() {
  const accounts = AccountDB.getAll();
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

  const headers = ['Date', 'Type', 'Category', 'Amount (Rs.)', 'Account', 'Note'];
  const rows = state.filtered.map(t => [
    t.date,
    t.type,
    t.category,
    t.amount,
    accMap[t.accountId] || '',
    `"${(t.note || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported! ⬇️', 'success');
}
