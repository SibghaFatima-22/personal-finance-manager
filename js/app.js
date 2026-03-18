/**
 * app.js — Application Entry Point
 * Personal Finance Manager
 */

import { seedDemoData, SettingsDB } from './db.js';
import { showToast } from './utils/helpers.js';

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Seed demo data on first launch
  seedDemoData();

  // Apply saved theme
  const settings = SettingsDB.get();
  document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

  // Highlight active nav link
  highlightActiveNav();

  console.log('✅ Personal Finance Manager loaded');
});

// ─── Navigation ───────────────────────────────────────────────────────────────

function highlightActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav__link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    if (href === currentPage) {
      link.classList.add('nav__link--active');
    }
  });
}

// ─── Global exports (for inline onclick fallbacks) ───────────────────────────
window.showToast = showToast;
