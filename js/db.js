/**
 * db.js — LocalStorage Database Engine
 * Personal Finance Manager
 * Acts as our full CRUD data layer using localStorage
 */

const DB_KEYS = {
  TRANSACTIONS: 'pfm_transactions',
  ACCOUNTS: 'pfm_accounts',
  BUDGETS: 'pfm_budgets',
  SETTINGS: 'pfm_settings',
};

// ─── Generic Helpers ────────────────────────────────────────────────────────

function _get(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`DB read error [${key}]:`, e);
    return [];
  }
}

function _set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`DB write error [${key}]:`, e);
    return false;
  }
}

function _generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────

export const TransactionDB = {
  /**
   * Get all transactions
   * @returns {Array}
   */
  getAll() {
    return _get(DB_KEYS.TRANSACTIONS);
  },

  /**
   * Get a single transaction by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    const all = this.getAll();
    return all.find(t => t.id === id) || null;
  },

  /**
   * Create a new transaction
   * @param {Object} data - { type, amount, category, accountId, date, note }
   * @returns {Object} created transaction
   */
  create(data) {
    const transactions = this.getAll();
    const newTransaction = {
      id: _generateId(),
      type: data.type,           // 'income' | 'expense'
      amount: parseFloat(data.amount),
      category: data.category,
      accountId: data.accountId,
      date: data.date || new Date().toISOString().split('T')[0],
      note: data.note || '',
      createdAt: new Date().toISOString(),
    };
    transactions.push(newTransaction);
    _set(DB_KEYS.TRANSACTIONS, transactions);
    return newTransaction;
  },

  /**
   * Update an existing transaction
   * @param {string} id
   * @param {Object} updates
   * @returns {Object|null} updated transaction
   */
  update(id, updates) {
    const transactions = this.getAll();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return null;
    transactions[index] = {
      ...transactions[index],
      ...updates,
      amount: parseFloat(updates.amount ?? transactions[index].amount),
      updatedAt: new Date().toISOString(),
    };
    _set(DB_KEYS.TRANSACTIONS, transactions);
    return transactions[index];
  },

  /**
   * Delete a transaction by ID
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const transactions = this.getAll();
    const filtered = transactions.filter(t => t.id !== id);
    if (filtered.length === transactions.length) return false;
    _set(DB_KEYS.TRANSACTIONS, filtered);
    return true;
  },

  /**
   * Filter transactions by criteria
   * @param {Object} filters - { type, category, accountId, startDate, endDate }
   * @returns {Array}
   */
  filter(filters = {}) {
    let results = this.getAll();
    if (filters.type) {
      results = results.filter(t => t.type === filters.type);
    }
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }
    if (filters.accountId) {
      results = results.filter(t => t.accountId === filters.accountId);
    }
    if (filters.startDate) {
      results = results.filter(t => t.date >= filters.startDate);
    }
    if (filters.endDate) {
      results = results.filter(t => t.date <= filters.endDate);
    }
    // Sort newest first by default
    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  /**
   * Get total income and expenses
   * @param {Array} transactions - optional subset
   * @returns {{ income: number, expenses: number, balance: number }}
   */
  getSummary(transactions = null) {
    const data = transactions || this.getAll();
    const income = data
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = data
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  },
};

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

export const AccountDB = {
  getAll() {
    return _get(DB_KEYS.ACCOUNTS);
  },

  getById(id) {
    return this.getAll().find(a => a.id === id) || null;
  },

  create(data) {
    const accounts = this.getAll();
    const newAccount = {
      id: _generateId(),
      name: data.name,
      type: data.type,     // 'cash' | 'bank' | 'card' | 'savings'
      balance: parseFloat(data.balance) || 0,
      color: data.color || '#6366f1',
      icon: data.icon || '💳',
      createdAt: new Date().toISOString(),
    };
    accounts.push(newAccount);
    _set(DB_KEYS.ACCOUNTS, accounts);
    return newAccount;
  },

  update(id, updates) {
    const accounts = this.getAll();
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) return null;
    accounts[index] = { ...accounts[index], ...updates, updatedAt: new Date().toISOString() };
    _set(DB_KEYS.ACCOUNTS, accounts);
    return accounts[index];
  },

  delete(id) {
    const accounts = this.getAll();
    const filtered = accounts.filter(a => a.id !== id);
    if (filtered.length === accounts.length) return false;
    _set(DB_KEYS.ACCOUNTS, filtered);
    return true;
  },

  /**
   * Recalculate account balance from transactions
   * @param {string} id
   */
  recalculateBalance(id) {
    const transactions = TransactionDB.filter({ accountId: id });
    const { income, expenses } = TransactionDB.getSummary(transactions);
    const account = this.getById(id);
    if (!account) return null;
    return this.update(id, { balance: account.initialBalance + income - expenses });
  },
};

// ─── BUDGETS ─────────────────────────────────────────────────────────────────

export const BudgetDB = {
  getAll() {
    return _get(DB_KEYS.BUDGETS);
  },

  getById(id) {
    return this.getAll().find(b => b.id === id) || null;
  },

  create(data) {
    const budgets = this.getAll();
    const newBudget = {
      id: _generateId(),
      category: data.category,
      limit: parseFloat(data.limit),
      month: data.month,   // format: 'YYYY-MM'
      createdAt: new Date().toISOString(),
    };
    budgets.push(newBudget);
    _set(DB_KEYS.BUDGETS, budgets);
    return newBudget;
  },

  update(id, updates) {
    const budgets = this.getAll();
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) return null;
    budgets[index] = { ...budgets[index], ...updates, updatedAt: new Date().toISOString() };
    _set(DB_KEYS.BUDGETS, budgets);
    return budgets[index];
  },

  delete(id) {
    const budgets = this.getAll();
    const filtered = budgets.filter(b => b.id !== id);
    if (filtered.length === budgets.length) return false;
    _set(DB_KEYS.BUDGETS, filtered);
    return true;
  },

  /**
   * Get budget with current spending for a given month
   * @param {string} month - 'YYYY-MM'
   * @returns {Array} budgets with .spent and .remaining fields
   */
  getBudgetsWithSpending(month) {
    const budgets = this.getAll().filter(b => b.month === month);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    const expenses = TransactionDB.filter({ type: 'expense', startDate, endDate });

    return budgets.map(budget => {
      const spent = expenses
        .filter(t => t.category === budget.category)
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        ...budget,
        spent,
        remaining: budget.limit - spent,
        percentage: Math.min((spent / budget.limit) * 100, 100),
      };
    });
  },
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export const SettingsDB = {
  get() {
    try {
      const data = localStorage.getItem(DB_KEYS.SETTINGS);
      return data ? JSON.parse(data) : this.getDefaults();
    } catch {
      return this.getDefaults();
    }
  },

  getDefaults() {
    return {
      currency: 'PKR',
      currencySymbol: 'Rs.',
      theme: 'dark',
      userName: 'Miss Sibgha',
    };
  },

  update(updates) {
    const current = this.get();
    const updated = { ...current, ...updates };
    localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },
};

// ─── SEED DATA (for first-time load) ─────────────────────────────────────────

export function seedDemoData() {
  // Only seed if no data exists
  if (TransactionDB.getAll().length > 0) return;

  // Create default accounts
  const cashAcc = AccountDB.create({ name: 'Cash Wallet', type: 'cash', balance: 5000, color: '#22c55e', icon: '💵' });
  const bankAcc = AccountDB.create({ name: 'Bank Account', type: 'bank', balance: 50000, color: '#6366f1', icon: '🏦' });

  // Seed some transactions for the current month
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');

  const sampleTransactions = [
    { type: 'income',  amount: 45000, category: 'Salary',       accountId: bankAcc.id, date: `${yyyy}-${mm}-01`, note: 'Monthly salary' },
    { type: 'income',  amount: 5000,  category: 'Freelance',    accountId: cashAcc.id, date: `${yyyy}-${mm}-05`, note: 'Web design project' },
    { type: 'expense', amount: 8000,  category: 'Rent',         accountId: bankAcc.id, date: `${yyyy}-${mm}-02`, note: 'Monthly rent' },
    { type: 'expense', amount: 2500,  category: 'Food',         accountId: cashAcc.id, date: `${yyyy}-${mm}-06`, note: 'Groceries' },
    { type: 'expense', amount: 1200,  category: 'Transport',    accountId: cashAcc.id, date: `${yyyy}-${mm}-07`, note: 'Fuel' },
    { type: 'expense', amount: 3000,  category: 'Utilities',    accountId: bankAcc.id, date: `${yyyy}-${mm}-08`, note: 'Electricity bill' },
    { type: 'expense', amount: 1500,  category: 'Food',         accountId: cashAcc.id, date: `${yyyy}-${mm}-10`, note: 'Restaurant' },
    { type: 'income',  amount: 2000,  category: 'Other',        accountId: cashAcc.id, date: `${yyyy}-${mm}-12`, note: 'Sold old items' },
    { type: 'expense', amount: 800,   category: 'Entertainment',accountId: cashAcc.id, date: `${yyyy}-${mm}-13`, note: 'Netflix & cinema' },
    { type: 'expense', amount: 4000,  category: 'Shopping',     accountId: bankAcc.id, date: `${yyyy}-${mm}-14`, note: 'Clothes' },
  ];

  sampleTransactions.forEach(t => TransactionDB.create(t));

  // Seed budgets for current month
  const currentMonth = `${yyyy}-${mm}`;
  const budgetData = [
    { category: 'Food',          limit: 5000,  month: currentMonth },
    { category: 'Transport',     limit: 3000,  month: currentMonth },
    { category: 'Entertainment', limit: 2000,  month: currentMonth },
    { category: 'Shopping',      limit: 6000,  month: currentMonth },
    { category: 'Utilities',     limit: 4000,  month: currentMonth },
  ];
  budgetData.forEach(b => BudgetDB.create(b));

  console.log('✅ Demo data seeded successfully');
}
