/**
 * helpers.js — Utility functions
 * Personal Finance Manager
 */

import { SettingsDB } from '../db.js';

// ─── Currency ────────────────────────────────────────────────────────────────

export function formatCurrency(amount) {
  const settings = SettingsDB.get();
  const symbol = settings.currencySymbol || 'Rs.';
  return `${symbol} ${Number(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Date ────────────────────────────────────────────────────────────────────

export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthRange(month) {
  // month = 'YYYY-MM'
  const [year, mon] = month.split('-').map(Number);
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${year}-${String(mon).padStart(2, '0')}-${lastDay}`;
  return { startDate, endDate };
}

export function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
}

export function getYearRange(year = null) {
  const y = year || new Date().getFullYear();
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export function getMonthName(monthStr) {
  const [year, mon] = monthStr.split('-');
  const date = new Date(year, mon - 1, 1);
  return date.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
}

// ─── Category Helpers ────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'Food', 'Transport', 'Rent', 'Utilities',
  'Entertainment', 'Shopping', 'Health', 'Education', 'Other',
];

export const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other',
];

export const CATEGORY_ICONS = {
  Food: '🍔', Transport: '🚗', Rent: '🏠', Utilities: '💡',
  Entertainment: '🎬', Shopping: '🛍️', Health: '❤️', Education: '📚',
  Salary: '💼', Freelance: '💻', Business: '📊', Investment: '📈',
  Gift: '🎁', Other: '📦',
};

export const CATEGORY_COLORS = {
  Food: '#f97316', Transport: '#3b82f6', Rent: '#8b5cf6', Utilities: '#eab308',
  Entertainment: '#ec4899', Shopping: '#14b8a6', Health: '#ef4444', Education: '#6366f1',
  Salary: '#22c55e', Freelance: '#10b981', Business: '#06b6d4', Investment: '#84cc16',
  Gift: '#f43f5e', Other: '#94a3b8',
};

// ─── Number Helpers ──────────────────────────────────────────────────────────

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function percentageColor(pct) {
  if (pct >= 100) return '#ef4444';
  if (pct >= 80) return '#f97316';
  if (pct >= 60) return '#eab308';
  return '#22c55e';
}

// ─── DOM Helpers ─────────────────────────────────────────────────────────────

export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  });
  children.forEach(child => {
    if (typeof child === 'string') el.insertAdjacentHTML('beforeend', child);
    else el.appendChild(child);
  });
  return el;
}

export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = createElement('div', {
    class: `toast toast--${type}`,
    html: `<span>${icons[type] || ''}</span> ${message}`,
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
