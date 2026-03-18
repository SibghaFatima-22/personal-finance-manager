/**
 * validator.js — Form Validation Utilities
 * Personal Finance Manager
 */

// ─── Rules ───────────────────────────────────────────────────────────────────

export const rules = {
  required: (value) => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return 'This field is required.';
    }
    return null;
  },

  positiveNumber: (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return 'Must be a positive number.';
    return null;
  },

  minLength: (min) => (value) => {
    if (!value || value.trim().length < min) return `Must be at least ${min} characters.`;
    return null;
  },

  maxLength: (max) => (value) => {
    if (value && value.trim().length > max) return `Must be no more than ${max} characters.`;
    return null;
  },

  validDate: (value) => {
    if (!value) return 'Date is required.';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Invalid date.';
    return null;
  },
};

// ─── Validate a full form schema ─────────────────────────────────────────────

/**
 * @param {Object} data - key: value pairs
 * @param {Object} schema - key: [ruleFn, ...] pairs
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validate(data, schema) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const error = rule(data[field]);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── DOM: Show/clear field errors ────────────────────────────────────────────

export function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('input--error');
  let errorEl = field.parentElement.querySelector('.field-error');
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    field.parentElement.appendChild(errorEl);
  }
  errorEl.textContent = message;
}

export function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.remove('input--error');
  const errorEl = field.parentElement.querySelector('.field-error');
  if (errorEl) errorEl.remove();
}

export function clearAllErrors(formEl) {
  formEl.querySelectorAll('.input--error').forEach(el => el.classList.remove('input--error'));
  formEl.querySelectorAll('.field-error').forEach(el => el.remove());
}

export function applyErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => showFieldError(field, message));
}
