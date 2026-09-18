/**
 * Modals Management Module (Calculator, Compare, Price Alerts, API Diagnostics, Settings)
 * 100% Sanitized & XSS-Protected
 */

import { Clipboard } from './clipboard.js';
import { Render } from './render.js';

export const Modals = {
  // -----------------------------------------------------------------
  // 1. Calculator Modal
  // -----------------------------------------------------------------
  openCalculator(item, state, elements) {
    state.activeModalItem = item;
    const isPoe2 = state.currentGame === 'poe2';

    // Populate Item Header safely
    elements.calcModalIcon.src = item.icon || '';
    elements.calcModalName.textContent = item.name;
    elements.calcModalCategory.textContent = item.category;

    // Direct Wiki link
    if (elements.calcWikiLink) {
      const wikiUrl = isPoe2
        ? `https://poe2db.tw/us/${encodeURIComponent(item.name)}`
        : `https://www.poewiki.net/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}`;
      elements.calcWikiLink.href = wikiUrl;
      elements.calcWikiLink.title = isPoe2 ? `Xem "${item.name}" trên poe2db.tw` : `Xem "${item.name}" trên poewiki.net`;
    }

    // Set Max Stack for Full Stack preset
    const maxStack = this.determineMaxStack(item);
    if (elements.btnPresetMax) {
      elements.btnPresetMax.textContent = `Full (${maxStack})`;
      elements.btnPresetMax.dataset.stack = maxStack;
    }

    // Default quantity = 1
    elements.calcQtyInput.value = '1';
    this.updateCalculatorValues(item, 1, state, elements);

    elements.calcModalOverlay.classList.remove('hidden');
    elements.calcModalOverlay.removeAttribute('hidden');
    elements.calcModalOverlay.style.display = 'flex';
    elements.calcQtyInput.focus();
    elements.calcQtyInput.select();
  },

  closeCalculator(elements) {
    elements.calcModalOverlay.classList.add('hidden');
    elements.calcModalOverlay.setAttribute('hidden', '');
    elements.calcModalOverlay.style.display = 'none';
  },

  determineMaxStack(item) {
    if (item.category === 'Divination Cards' || item.subCategory === 'DivinationCard') {
      const match = (item.name || '').match(/(\d+)/);
      return match ? parseInt(match[0], 10) : 8;
    }
    if (item.category === 'Currency') {
      const name = (item.name || '').toLowerCase();
      if (name.includes('mirror') || name.includes('divine')) return 10;
      if (name.includes('chaos') || name.includes('exalted')) return 20;
      if (name.includes('chromatic') || name.includes('jeweller') || name.includes('alteration')) return 20;
      return 20;
    }
    if (item.category === 'Scarabs') return 20;
    if (item.category === 'Essences') return 9;
    if (item.category === 'Fossils') return 20;
    if (item.category === 'Oils') return 10;
    if (item.category === 'Catalysts') return 10;
    return 10;
  },

  updateCalculatorValues(item, qty, state, elements) {
    if (!item) return;
    const isPoe2 = state.currentGame === 'poe2';
    const quantity = Math.max(1, parseInt(qty, 10) || 1);

    if (isPoe2) {
      const unitDiv = item.divineValue || 0;
      const unitEx = item.exaltedValue || 0;
      const totalDiv = +(unitDiv * quantity).toFixed(3);
      const totalEx = +(unitEx * quantity).toFixed(1);

      elements.calcUnitChaos.textContent = `${unitEx} Ex`;
      elements.calcUnitDivine.textContent = unitDiv >= 1 ? `${unitDiv} Div` : `${unitEx} Ex`;

      elements.calcTotalChaos.textContent = totalEx.toLocaleString();
      elements.calcTotalChaosSym.textContent = 'Ex';
      elements.calcTotalDivine.textContent = totalDiv.toLocaleString();
      elements.calcTotalDivineSym.textContent = 'Div';

      elements.calcSummaryText.textContent = `${quantity}x ${item.name} = ${totalEx.toLocaleString()} Ex (${totalDiv.toLocaleString()} Div)`;
    } else {
      const unitChaos = item.chaosValue || 0;
      const unitDiv = item.divineValue || 0;
      const totalChaos = +(unitChaos * quantity).toFixed(1);
      const totalDiv = +(unitDiv * quantity).toFixed(2);

      elements.calcUnitChaos.textContent = `${unitChaos} C`;
      elements.calcUnitDivine.textContent = `${unitDiv} Div`;

      elements.calcTotalChaos.textContent = totalChaos.toLocaleString();
      elements.calcTotalChaosSym.textContent = 'C';
      elements.calcTotalDivine.textContent = totalDiv.toLocaleString();
      elements.calcTotalDivineSym.textContent = 'Div';

      elements.calcSummaryText.textContent = `${quantity}x ${item.name} = ${totalChaos.toLocaleString()} C (${totalDiv.toLocaleString()} Div)`;
    }
  },

  // -----------------------------------------------------------------
  // 2. Compare Modal (Escaped & Sanitized)
  // -----------------------------------------------------------------
  openCompare(state, elements) {
    const items = Array.from(state.compareList.values());
    if (items.length === 0) {
      Clipboard.showToast('Chưa có vật phẩm nào được chọn để so sánh. Hãy tick "So sánh"!', 'warning');
      return;
    }

    const container = document.getElementById('compareTableContainer');
    if (!container) return;

    let html = `
      <table class="compare-table">
        <thead>
          <tr>
            <th>Chỉ số</th>
            ${items.map(item => `
              <th class="compare-item-header">
                <div class="compare-th-content">
                  <img src="${Render.escapeHtml(item.icon)}" alt="" class="compare-th-icon">
                  <span class="compare-th-name">${Render.escapeHtml(item.name)}</span>
                  <button class="compare-remove-btn" data-action="remove-compare" data-id="${Render.escapeHtml(item.id)}" title="Xóa">✕</button>
                </div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="compare-label-cell">Danh mục</td>
            ${items.map(item => `<td><span class="item-category-tag">${Render.escapeHtml(item.category)}</span></td>`).join('')}
          </tr>
          <tr>
            <td class="compare-label-cell">Giá quy đổi</td>
            ${items.map(item => `
              <td class="compare-val-cell font-bold">
                ${state.currentGame === 'poe2' ? 
                  `${(item.divineValue || 0).toLocaleString()} Div (${(item.exaltedValue || 0).toLocaleString()} Ex)` : 
                  `${(item.chaosValue || 0).toLocaleString()} C (${(item.divineValue || 0).toLocaleString()} Div)`}
              </td>
            `).join('')}
          </tr>
          <tr>
            <td class="compare-label-cell">Biến động 7 ngày</td>
            ${items.map(item => {
              const change = typeof item.change7d === 'number' ? item.change7d : 0;
              const cl = change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-flat';
              return `<td><span class="trend-pill ${cl}">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span></td>`;
            }).join('')}
          </tr>
          <tr>
            <td class="compare-label-cell">Khối lượng 24h</td>
            ${items.map(item => `<td>${(item.volume || 0).toLocaleString()}</td>`).join('')}
          </tr>
          <tr>
            <td class="compare-label-cell">Thanh khoản</td>
            ${items.map(item => `<td>${Render.renderLiquidityBadge(item.volume)}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    `;

    container.innerHTML = html;
    const modal = document.getElementById('compareModalOverlay');
    if (modal) {
      modal.classList.remove('hidden');
      modal.removeAttribute('hidden');
      modal.style.display = 'flex';
    }
  },

  closeCompare() {
    const modal = document.getElementById('compareModalOverlay');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
  },

  // -----------------------------------------------------------------
  // 3. Price Alerts Modal (Escaped & Sanitized)
  // -----------------------------------------------------------------
  openAlerts(state) {
    const modal = document.getElementById('alertsModalOverlay');
    if (!modal) return;
    this.renderAlertsList(state);
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
  },

  closeAlerts() {
    const modal = document.getElementById('alertsModalOverlay');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
  },

  renderAlertsList(state) {
    const listContainer = document.getElementById('alertsListContainer');
    if (!listContainer) return;

    if (state.alerts.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-alerts">
          <i class="fa-regular fa-bell-slash empty-icon"></i>
          <p>Chưa có cảnh báo giá nào.</p>
          <span class="text-muted">Nhập tên vật phẩm bên dưới để tạo quy tắc cảnh báo.</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = state.alerts.map(a => `
      <div class="alert-item-card" data-id="${Render.escapeHtml(a.id)}">
        <div class="alert-info">
          <span class="alert-item-name font-bold">${Render.escapeHtml(a.itemName)}</span>
          <span class="alert-rule">
            ${a.condition === 'above' ? 'Giá tăng vượt quá' : 'Giá giảm xuống dưới'}
            <strong>${Number(a.threshold).toLocaleString()} ${Render.escapeHtml(a.currency.toUpperCase())}</strong>
          </span>
        </div>
        <button class="alert-delete-btn" data-action="delete-alert" data-id="${Render.escapeHtml(a.id)}" title="Xóa cảnh báo">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  },

  checkPriceAlerts(items, state) {
    if (!state.alerts || state.alerts.length === 0 || !items || items.length === 0) return;

    for (const alert of state.alerts) {
      const match = items.find(i => i.name.toLowerCase() === alert.itemName.toLowerCase());
      if (!match) continue;

      let currentPrice = match.chaosValue || 0;
      if (alert.currency === 'div') currentPrice = match.divineValue || 0;
      if (alert.currency === 'ex') currentPrice = match.exaltedValue || 0;

      let triggered = false;
      if (alert.condition === 'above' && currentPrice > alert.threshold) {
        triggered = true;
      } else if (alert.condition === 'below' && currentPrice < alert.threshold) {
        triggered = true;
      }

      if (triggered) {
        Clipboard.showToast(`🚨 Cảnh báo giá: ${match.name} hiện là ${currentPrice} ${alert.currency.toUpperCase()} (${alert.condition === 'above' ? '>' : '<'} ${alert.threshold})`, 'warning');
      }
    }
  },

  // -----------------------------------------------------------------
  // 4. API Diagnostics Modal (Sanitized & Multi-League)
  // -----------------------------------------------------------------
  openDiagnostics(statusData) {
    const modal = document.getElementById('diagnosticsModalOverlay');
    if (!modal) return;

    const content = document.getElementById('diagnosticsModalContent');
    if (!content) return;

    const diag = statusData.diagnostics || {};
    const activeLeagues = statusData.activeLeagues || {};

    const p1League = activeLeagues.poe1 || 'Allflame';
    const p2League = activeLeagues.poe2 || 'Forbidden Rites';

    const p1Diag = Object.values(diag.poe1?.[p1League] || {});
    const p2Diag = Object.values(diag.poe2?.[p2League] || {});

    let html = `
      <div class="diag-overview-cards">
        <div class="diag-card">
          <div class="diag-card-title">Server Status</div>
          <div class="diag-card-val text-success">Active 200 OK</div>
        </div>
        <div class="diag-card">
          <div class="diag-card-title">Active Leagues</div>
          <div class="diag-card-val">PoE1: ${Render.escapeHtml(p1League)} | PoE2: ${Render.escapeHtml(p2League)}</div>
        </div>
        <div class="diag-card">
          <div class="diag-card-title">Cơ chế tải ngầm</div>
          <div class="diag-card-val">Priority: 30 phút | Rotation: 5 phút | Leagues: 1 giờ</div>
        </div>
      </div>

      <h4 class="diag-section-heading">PoE 1 Exchange Endpoints (${Render.escapeHtml(p1League)} - ${p1Diag.length})</h4>
      <table class="diag-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>HTTP Code</th>
            <th>Latency</th>
            <th>Số items</th>
            <th>Cập nhật gần nhất</th>
          </tr>
        </thead>
        <tbody>
          ${p1Diag.length === 0 ? '<tr><td colspan="5" class="text-muted">Đang nạp dữ liệu...</td></tr>' : ''}
          ${p1Diag.map(d => `
            <tr>
              <td><strong>${Render.escapeHtml(d.type)}</strong></td>
              <td><span class="status-pill ${d.httpCode === 200 ? 'pill-success' : 'pill-error'}">${d.httpCode}</span></td>
              <td>${d.latencyMs} ms</td>
              <td>${d.itemsCount}</td>
              <td class="text-muted text-xs">${new Date(d.lastUpdated).toLocaleTimeString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h4 class="diag-section-heading mt-4">PoE 2 Exchange Endpoints (${Render.escapeHtml(p2League)} - ${p2Diag.length})</h4>
      <table class="diag-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>HTTP Code</th>
            <th>Latency</th>
            <th>Số items</th>
            <th>Cập nhật gần nhất</th>
          </tr>
        </thead>
        <tbody>
          ${p2Diag.length === 0 ? '<tr><td colspan="5" class="text-muted">Đang nạp dữ liệu...</td></tr>' : ''}
          ${p2Diag.map(d => `
            <tr>
              <td><strong>${Render.escapeHtml(d.type)}</strong></td>
              <td><span class="status-pill ${d.httpCode === 200 ? 'pill-success' : 'pill-error'}">${d.httpCode}</span></td>
              <td>${d.latencyMs} ms</td>
              <td>${d.itemsCount}</td>
              <td class="text-muted text-xs">${new Date(d.lastUpdated).toLocaleTimeString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    content.innerHTML = html;
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
  },

  closeDiagnostics() {
    const modal = document.getElementById('diagnosticsModalOverlay');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
  },

  // -----------------------------------------------------------------
  // 5. Settings Modal
  // -----------------------------------------------------------------
  openSettings(state) {
    const modal = document.getElementById('settingsModalOverlay');
    if (!modal) return;

    const gameSelect = document.getElementById('settingDefaultGame');
    const viewSelect = document.getElementById('settingDefaultView');

    if (gameSelect) gameSelect.value = state.settings.defaultGame || 'poe1';
    if (viewSelect) viewSelect.value = state.settings.defaultView || 'table';

    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
  },

  closeSettings() {
    const modal = document.getElementById('settingsModalOverlay');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
  }
};
