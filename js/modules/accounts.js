/**
 * accounts.js — Full CRUD Accounts Module
 * Personal Finance Manager
 *
 * Features:
 *  - Total balance banner across all accounts
 *  - Account cards grid (cash, bank, card, savings)
 *  - Add account with icon picker + color picker
 *  - Edit account details
 *  - Delete account (with transaction warning)
 *  - Per-account: income, expense, transaction count
 *  - Recent transactions per account panel
 */

import { AccountDB, TransactionDB, seedDemoData } from '../db.js';
import {
  formatCurrency, formatDateShort,
  CATEGORY_ICONS,
  showToast,
} from '../utils/helpers.js';
import {
  validate, rules, clearAllErrors, applyErrors,
} from '../utils/validator.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'savings'];

const ACCOUNT_TYPE_ICONS = {
  cash:    '💵',
  bank:    '🏦',
  card:    '💳',
  savings: '🐖',
};

const ACCOUNT_ICONS = [
  '💵','🏦','💳','🐖','💼','🏧','💰','🪙','📊','💹','🏠','🚗',
  '✈️','🎓','❤️','🛒','💻','📱','🎯','⭐',
];

const ACCENT_COLORS = [
  '#7c6ff7','#6366f1','#3b82f6','#22c55e',
  '#10b981','#f97316','#ef4444','#ec4899',
  '#eab308','#14b8a6','#06b6d4','#8b5cf6',
];

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  editingId:   null,
  deleteId:    null,
  selectedIcon:  '🏦',
  selectedColor: '#7c6ff7',
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  render();
  initAddButton();
});

// ─── Main Render ──────────────────────────────────────────────────────────────

function render() {
  renderBanner();
  renderAccountsGrid();
}

// ─── Balance Banner ───────────────────────────────────────────────────────────

function renderBanner() {
  const container = document.getElementById('accountsBanner');
  if (!container) {
    // First render — inject banner above root
    const root = document.getElementById('accountsRoot');
    const banner = document.createElement('div');
    banner.id = 'accountsBanner';
    root.parentElement.insertBefore(banner, root);
  }

  const accounts  = AccountDB.getAll();
  const allTxns   = TransactionDB.getAll();
  const { income, expenses } = TransactionDB.getSummary(allTxns);
  const totalBal  = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  document.getElementById('accountsBanner').innerHTML = `
    <div class="balance-banner">
      <div>
        <div class="balance-banner__label">Total Net Worth</div>
        <div class="balance-banner__amount">${formatCurrency(totalBal)}</div>
        <div class="balance-banner__sub">${accounts.length} account${accounts.length !== 1 ? 's' : ''} connected</div>
      </div>
      <div class="balance-banner__stats">
        <div class="balance-banner__stat">
          <div class="balance-banner__stat-label">All-time Income</div>
          <div class="balance-banner__stat-value text-income">${formatCurrency(income)}</div>
        </div>
        <div class="balance-banner__stat">
          <div class="balance-banner__stat-label">All-time Expenses</div>
          <div class="balance-banner__stat-value text-expense">${formatCurrency(expenses)}</div>
        </div>
      </div>
    </div>`;
}

// ─── Accounts Grid ────────────────────────────────────────────────────────────

function renderAccountsGrid() {
  const root = document.getElementById('accountsRoot');
  const accounts = AccountDB.getAll();

  if (accounts.length === 0) {
    root.innerHTML = `
      <div class="accounts-grid">
        ${addCard()}
      </div>
      <div class="empty-state" style="padding:40px 0">
        <div class="empty-state__icon">🏦</div>
        <div class="empty-state__title">No accounts yet</div>
        <div class="empty-state__desc">Add your first account to start tracking</div>
      </div>`;
    attachAddCardListener();
    return;
  }

  root.innerHTML = `
    <div class="accounts-grid" id="accountsGrid">
      ${accounts.map(a => accountCard(a)).join('')}
      ${addCard()}
    </div>`;

  attachAddCardListener();

  // Attach edit/delete listeners via delegation
  root.querySelectorAll('[data-edit-acc]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFormModal(btn.dataset.editAcc);
    });
  });
  root.querySelectorAll('[data-delete-acc]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(btn.dataset.deleteAcc);
    });
  });
}

function attachAddCardListener() {
  document.getElementById('addAccCard')?.addEventListener('click', () => openFormModal(null));
}

// ─── Account Card HTML ────────────────────────────────────────────────────────

function accountCard(account) {
  const txns    = TransactionDB.filter({ accountId: account.id });
  const { income, expenses } = TransactionDB.getSummary(txns);

  // Compute live balance = initial balance + income - expenses
  const liveBalance = (account.balance || 0) + income - expenses;
  const color = account.color || '#7c6ff7';

  return `
    <div class="account-card" style="--acc-color:${color}">
      <div class="account-card__top">
        <div class="account-card__icon-wrap">${account.icon || '💳'}</div>
        <div class="account-card__actions">
          <button class="btn btn--secondary btn--sm btn--icon" data-edit-acc="${account.id}" title="Edit">✏️</button>
          <button class="btn btn--danger btn--sm btn--icon" data-delete-acc="${account.id}" title="Delete">🗑️</button>
        </div>
      </div>

      <div class="account-card__name">${account.name}</div>
      <div class="account-card__type">${ACCOUNT_TYPE_ICONS[account.type] || ''} ${account.type}</div>

      <div style="margin:16px 0 6px">
        <div class="account-card__balance-label">Current Balance</div>
        <div class="account-card__balance">${formatCurrency(liveBalance)}</div>
      </div>

      <div class="account-card__divider"></div>

      <div class="account-card__stats">
        <div class="account-card__stat">
          <div class="account-card__stat-label">Income</div>
          <div class="account-card__stat-value text-income">${formatCurrency(income)}</div>
        </div>
        <div class="account-card__stat">
          <div class="account-card__stat-label">Expenses</div>
          <div class="account-card__stat-value text-expense">${formatCurrency(expenses)}</div>
        </div>
        <div class="account-card__stat">
          <div class="account-card__stat-label">Transactions</div>
          <div class="account-card__stat-value">${txns.length}</div>
        </div>
      </div>
    </div>`;
}

function addCard() {
  return `
    <div class="account-card account-card--add" id="addAccCard">
      <div class="account-card--add__icon">＋</div>
      <div class="account-card--add__text">Add New Account</div>
    </div>`;
}

// ─── Add Button (page header) ─────────────────────────────────────────────────

function initAddButton() {
  document.getElementById('addAccountBtn')?.addEventListener('click', () => openFormModal(null));
}

// ─── FORM MODAL (Add / Edit) ──────────────────────────────────────────────────

function openFormModal(id) {
  state.editingId    = id || null;
  state.selectedIcon  = '🏦';
  state.selectedColor = '#7c6ff7';

  const isEdit = !!id;
  let account  = null;
  if (isEdit) {
    account = AccountDB.getById(id);
    if (!account) return;
    state.selectedIcon  = account.icon  || '🏦';
    state.selectedColor = account.color || '#7c6ff7';
  }

  const existing = document.getElementById('accFormOverlay');
  if (existing) existing.remove();

  const typeOptions = ACCOUNT_TYPES.map(t =>
    `<option value="${t}" ${account?.type === t ? 'selected' : ''}>${ACCOUNT_TYPE_ICONS[t]} ${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
  ).join('');

  const iconBtns = ACCOUNT_ICONS.map(ic =>
    `<button class="icon-picker__btn ${ic === state.selectedIcon ? 'selected' : ''}"
      data-icon="${ic}" type="button">${ic}</button>`
  ).join('');

  const colorSwatches = ACCENT_COLORS.map(c =>
    `<div class="color-picker__swatch ${c === state.selectedColor ? 'selected' : ''}"
      data-color="${c}"
      style="background:${c}"
      title="${c}"></div>`
  ).join('');

  const html = `
    <div class="modal-overlay" id="accFormOverlay">
      <div class="modal" style="max-width:520px">
        <div class="modal__header">
          <span class="modal__title">${isEdit ? 'Edit Account' : 'Add New Account'}</span>
          <button class="modal__close" id="closeAccForm">✕</button>
        </div>
        <div class="modal__body">

          <!-- Name -->
          <div class="form-group">
            <label class="form-label" for="accName">Account Name <span>*</span></label>
            <input type="text" class="form-input" id="accName"
              placeholder="e.g. Cash Wallet, HBL Account"
              value="${account?.name || ''}" maxlength="40" />
          </div>

          <!-- Type + Initial Balance -->
          <div class="grid grid--2" style="gap:12px">
            <div class="form-group mb-0">
              <label class="form-label" for="accType">Account Type <span>*</span></label>
              <select class="form-select" id="accType">${typeOptions}</select>
            </div>
            <div class="form-group mb-0">
              <label class="form-label" for="accBalance">
                ${isEdit ? 'Adjust Balance' : 'Opening Balance'} <span>*</span>
              </label>
              <input type="number" class="form-input" id="accBalance"
                placeholder="0.00" min="0" step="0.01"
                value="${account?.balance || 0}" />
            </div>
          </div>

          <!-- Icon Picker -->
          <div class="form-group" style="margin-top:16px">
            <label class="form-label">Icon</label>
            <div class="icon-picker" id="iconPicker">${iconBtns}</div>
          </div>

          <!-- Color Picker -->
          <div class="form-group">
            <label class="form-label">Card Color</label>
            <div class="color-picker" id="colorPicker">${colorSwatches}</div>
          </div>

          <!-- Preview -->
          <div class="form-group">
            <label class="form-label">Preview</label>
            <div id="accPreview" style="max-width:260px">
              ${previewCard(account?.name || 'Account Name', account?.type || 'bank',
                  state.selectedIcon, state.selectedColor, account?.balance || 0)}
            </div>
          </div>

        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" id="cancelAccForm">Cancel</button>
          <button class="btn btn--primary" id="saveAccForm">
            ${isEdit ? '💾 Update Account' : '✅ Add Account'}
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  // Events
  document.getElementById('closeAccForm').addEventListener('click', closeFormModal);
  document.getElementById('cancelAccForm').addEventListener('click', closeFormModal);
  document.getElementById('saveAccForm').addEventListener('click', saveAccount);
  document.getElementById('accFormOverlay').addEventListener('click', e => {
    if (e.target.id === 'accFormOverlay') closeFormModal();
  });

  // Icon picker
  document.getElementById('iconPicker').addEventListener('click', e => {
    const btn = e.target.closest('[data-icon]');
    if (!btn) return;
    document.querySelectorAll('.icon-picker__btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.selectedIcon = btn.dataset.icon;
    updatePreview();
  });

  // Color picker
  document.getElementById('colorPicker').addEventListener('click', e => {
    const swatch = e.target.closest('[data-color]');
    if (!swatch) return;
    document.querySelectorAll('.color-picker__swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    state.selectedColor = swatch.dataset.color;
    updatePreview();
  });

  // Live preview on name/type change
  ['accName','accType','accBalance'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
    document.getElementById(id)?.addEventListener('change', updatePreview);
  });

  requestAnimationFrame(() =>
    document.getElementById('accFormOverlay').classList.add('active')
  );
}

function updatePreview() {
  const name    = document.getElementById('accName')?.value || 'Account Name';
  const type    = document.getElementById('accType')?.value || 'bank';
  const balance = parseFloat(document.getElementById('accBalance')?.value) || 0;
  const preview = document.getElementById('accPreview');
  if (preview) {
    preview.innerHTML = previewCard(name, type, state.selectedIcon, state.selectedColor, balance);
  }
}

function previewCard(name, type, icon, color, balance) {
  return `
    <div style="background:var(--bg-card);border:1px solid ${color};border-radius:14px;
      padding:16px;border-top:3px solid ${color};position:relative;overflow:hidden">
      <div style="position:absolute;bottom:-20px;right:-20px;width:70px;height:70px;
        border-radius:50%;background:${color};opacity:0.08"></div>
      <div style="font-size:24px;margin-bottom:10px">${icon}</div>
      <div style="font-family:var(--font-display);font-size:14px;font-weight:700;
        color:var(--text-primary);margin-bottom:2px">${name || 'Account Name'}</div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:capitalize;
        margin-bottom:12px">${ACCOUNT_TYPE_ICONS[type]||''} ${type}</div>
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;
        letter-spacing:.06em;margin-bottom:3px">Balance</div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:800;
        color:var(--text-primary)">${formatCurrency(balance)}</div>
    </div>`;
}

function closeFormModal() {
  const modal = document.getElementById('accFormOverlay');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 350);
  }
  state.editingId = null;
}

function saveAccount() {
  const modal = document.getElementById('accFormOverlay');
  clearAllErrors(modal);

  const data = {
    name:    document.getElementById('accName').value.trim(),
    type:    document.getElementById('accType').value,
    balance: document.getElementById('accBalance').value,
    icon:    state.selectedIcon,
    color:   state.selectedColor,
  };

  const { valid, errors } = validate(data, {
    name:    [rules.required, rules.minLength(2)],
    type:    [rules.required],
    balance: [rules.required],
  });

  if (!valid) { applyErrors(errors); return; }

  if (state.editingId) {
    AccountDB.update(state.editingId, {
      name:    data.name,
      type:    data.type,
      balance: parseFloat(data.balance),
      icon:    data.icon,
      color:   data.color,
    });
    showToast('Account updated! ✏️', 'success');
  } else {
    AccountDB.create(data);
    showToast('Account added! 🎉', 'success');
  }

  closeFormModal();
  render();
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────

function openDeleteModal(id) {
  state.deleteId = id;
  const account = AccountDB.getById(id);
  if (!account) return;

  const txnCount = TransactionDB.filter({ accountId: id }).length;
  const existing = document.getElementById('accDeleteOverlay');
  if (existing) existing.remove();

  const html = `
    <div class="modal-overlay" id="accDeleteOverlay">
      <div class="modal" style="max-width:420px">
        <div class="modal__header">
          <span class="modal__title">Delete Account</span>
          <button class="modal__close" id="cancelAccDelete">✕</button>
        </div>
        <div class="modal__body" style="text-align:center;padding:32px 24px">
          <div style="font-size:48px;margin-bottom:16px">${account.icon}</div>
          <div style="font-family:var(--font-display);font-size:18px;font-weight:700;
            color:var(--text-primary);margin-bottom:8px">
            Delete "${account.name}"?
          </div>
          <div style="font-size:14px;color:var(--text-muted);line-height:1.6">
            This account will be permanently removed.
          </div>
          ${txnCount > 0 ? `
            <div class="delete-warning">
              ⚠️ <span>This account has <strong>${txnCount} transaction${txnCount !== 1 ? 's' : ''}</strong>
              linked to it. Those transactions will remain in the system but will show no account.</span>
            </div>` : ''}
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" id="cancelAccDelete2">Cancel</button>
          <button class="btn btn--danger" id="confirmAccDelete">🗑️ Delete Account</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('cancelAccDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelAccDelete2').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmAccDelete').addEventListener('click', executeDelete);
  document.getElementById('accDeleteOverlay').addEventListener('click', e => {
    if (e.target.id === 'accDeleteOverlay') closeDeleteModal();
  });

  requestAnimationFrame(() =>
    document.getElementById('accDeleteOverlay').classList.add('active')
  );
}

function closeDeleteModal() {
  const modal = document.getElementById('accDeleteOverlay');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 350);
  }
  state.deleteId = null;
}

function executeDelete() {
  if (!state.deleteId) return;
  AccountDB.delete(state.deleteId);
  closeDeleteModal();
  showToast('Account deleted.', 'info');
  render();
}
