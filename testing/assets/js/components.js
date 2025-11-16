/**
 * INHOST Testing Framework - Componentes Reutilizables
 * Sistema de componentes atómicos, moleculares y orgánicos
 */

'use strict';

// ========================================
// UTILITIES
// ========================================

const Utils = {
  // Sanitizar texto para prevenir XSS
  escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Formatear tiempo compacto
  formatTime(date = new Date()) {
    return date.toLocaleTimeString('en-US', { hour12: false }) +
           '.' + date.getMilliseconds().toString().padStart(3, '0');
  },

  // Formatear timestamp corto
  formatTimeShort(date = new Date()) {
    return date.toLocaleTimeString('en-US', { hour12: false });
  },

  // Generar ID único
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
};

// ========================================
// ATOMS - Componentes básicos
// ========================================

const Atoms = {
  // Badge
  badge(text, type = 'neutral') {
    return `<span class="badge badge-${type}">${Utils.escape(text)}</span>`;
  },

  // Button
  button(text, {
    onclick = '',
    disabled = false,
    type = '',
    size = '',
    id = ''
  } = {}) {
    const classes = ['btn', type && `btn-${type}`, size && `btn-${size}`]
      .filter(Boolean).join(' ');
    return `<button
      class="${classes}"
      ${onclick ? `onclick="${onclick}"` : ''}
      ${disabled ? 'disabled' : ''}
      ${id ? `id="${id}"` : ''}
    >${Utils.escape(text)}</button>`;
  },

  // Input
  input({
    id = '',
    placeholder = '',
    value = '',
    onkeypress = ''
  } = {}) {
    return `<input
      type="text"
      class="input"
      ${id ? `id="${id}"` : ''}
      ${placeholder ? `placeholder="${Utils.escape(placeholder)}"` : ''}
      ${value ? `value="${Utils.escape(value)}"` : ''}
      ${onkeypress ? `onkeypress="${onkeypress}"` : ''}
    >`;
  },

  // Progress bar
  progress(percent, type = '') {
    return `<div class="progress-mini">
      <div class="progress-mini-bar ${type}" style="width: ${percent}%"></div>
    </div>`;
  },

  // Stat
  stat(label, value) {
    return `<div class="stat">
      <span class="stat-label">${Utils.escape(label)}:</span>
      <span class="stat-value">${Utils.escape(value)}</span>
    </div>`;
  },

  // Log line
  logLine(type, badge, message, time = null) {
    return `<div class="log-line ${type}">
      <span class="log-time">${time || Utils.formatTime()}</span>
      <span class="log-badge">[${Utils.escape(badge)}]</span>
      <span class="log-message">${Utils.escape(message)}</span>
    </div>`;
  }
};

// ========================================
// MOLECULES - Componentes compuestos
// ========================================

const Molecules = {
  // Panel
  panel(title, content, { actions = '', id = '' } = {}) {
    return `<div class="panel" ${id ? `id="${id}"` : ''}>
      <div class="panel-header">
        <div class="panel-title">${title}</div>
        ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
      </div>
      <div class="panel-content">${content}</div>
    </div>`;
  },

  // Card micro
  cardMicro(title, {
    badge = '',
    meta = '',
    actions = '',
    icon = ''
  } = {}) {
    return `<div class="card-micro animate-slideUp">
      <div class="card-micro-header">
        <div class="card-micro-title">
          ${icon ? `<span>${icon}</span>` : ''}
          <span>${Utils.escape(title)}</span>
        </div>
        ${badge}
      </div>
      ${meta ? `<div class="card-micro-meta">${meta}</div>` : ''}
      ${actions ? `<div class="card-micro-actions">${actions}</div>` : ''}
    </div>`;
  },

  // Empty state
  emptyState(icon, message, submessage = '') {
    return `<div class="flex flex-col items-center justify-center" style="height: 100%; opacity: 0.3; text-align: center; padding: 20px;">
      <div style="font-size: 32px; margin-bottom: 8px;">${icon}</div>
      <div class="text-sm">${Utils.escape(message)}</div>
      ${submessage ? `<div class="text-xs text-muted">${Utils.escape(submessage)}</div>` : ''}
    </div>`;
  }
};

// ========================================
// ORGANISMS - Componentes complejos
// ========================================

const Organisms = {
  // Header principal
  header(title, stats = []) {
    const statsHtml = stats.map(s => Atoms.stat(s.label, s.value)).join('');
    return `<header class="header-main">
      <h1 class="header-title">${title}</h1>
      <div class="header-stats flex gap-md">${statsHtml}</div>
    </header>`;
  }
};

// ========================================
// LOG MANAGER - Sistema de logs con auto-scroll
// ========================================

class LogManager {
  constructor(containerId, maxEntries = 100) {
    this.container = document.getElementById(containerId);
    this.maxEntries = maxEntries;
    this.autoScroll = true;
  }

  add(type, badge, message) {
    if (!this.container) return;

    const line = document.createElement('div');
    line.className = `log-line ${type} animate-fadeIn`;
    line.innerHTML = `
      <span class="log-time">${Utils.formatTime()}</span>
      <span class="log-badge">[${Utils.escape(badge)}]</span>
      <span class="log-message">${Utils.escape(message)}</span>
    `;

    this.container.appendChild(line);

    // Limitar entradas
    while (this.container.children.length > this.maxEntries) {
      this.container.removeChild(this.container.firstChild);
    }

    // Auto-scroll si está activo
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = '';
      this.add('info', 'SYSTEM', 'Log cleared');
    }
  }

  scrollToBottom() {
    if (this.container) {
      requestAnimationFrame(() => {
        this.container.scrollTop = this.container.scrollHeight;
      });
    }
  }

  toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    return this.autoScroll;
  }

  // Copiar todo el log al portapapeles
  async copyAll() {
    if (!this.container) return false;

    const lines = Array.from(this.container.querySelectorAll('.log-line'))
      .map(line => line.textContent.trim())
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      return true;
    } catch (err) {
      console.error('Failed to copy logs:', err);
      return false;
    }
  }
}

// ========================================
// STATE MANAGER - Gestión de estado reactivo
// ========================================

class StateManager {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = {};
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;

    if (this.listeners[key]) {
      this.listeners[key].forEach(callback => callback(value, oldValue));
    }
  }

  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  subscribe(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
  }
}

// ========================================
// DOM CACHE - Optimización de acceso al DOM
// ========================================

class DOMCache {
  constructor() {
    this.cache = {};
  }

  get(id) {
    if (!this.cache[id]) {
      this.cache[id] = document.getElementById(id);
    }
    return this.cache[id];
  }

  getAll(ids) {
    return ids.reduce((acc, id) => {
      acc[id] = this.get(id);
      return acc;
    }, {});
  }

  clear() {
    this.cache = {};
  }
}

// ========================================
// EXPORT
// ========================================

// Hacer disponible globalmente
window.TestingFramework = {
  Utils,
  Atoms,
  Molecules,
  Organisms,
  LogManager,
  StateManager,
  DOMCache
};
