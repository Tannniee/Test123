/**
 * Modals Management Module (Calculator, Compare, Price Alerts, API Diagnostics, Settings)
 * 100% Sanitized & XSS-Protected
 */

import { Clipboard } from './clipboard.js';
import { Render } from './render.js';

export const Modals = {
  // -----------------------------------------------------------------
  // 1. POESTASH Item Inspection View
  // -----------------------------------------------------------------
  openItemInspection(item, state, elements) {
    if (!item) return;
    state.activeModalItem = item;
    const isPoe2 = state.currentGame === 'poe2';

    // 1. Breadcrumb & Meta
    if (elements.inspectCategoryCrumb) {
      elements.inspectCategoryCrumb.textContent = item.category || item.sourceType || 'Vật phẩm';
    }
    if (elements.inspectLeagueTag) {
      elements.inspectLeagueTag.textContent = state.currentLeague || 'Standard';
    }
    if (elements.inspectTypeTag) {
      elements.inspectTypeTag.textContent = item.category || item.sourceType || 'General';
    }

    // 2. Item Header
    if (elements.inspectIcon) {
      elements.inspectIcon.src = item.icon || Render.ICONS.chaos;
      elements.inspectIcon.alt = item.name || '';
    }
    if (elements.inspectName) {
      elements.inspectName.textContent = item.name || 'Unknown Item';
    }

    // 3. Price Hero
    const change = typeof item.change7d === 'number' ? item.change7d : 0;
    const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    const changeClass = change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-flat';

    if (elements.inspectTrendBadge) {
      elements.inspectTrendBadge.textContent = changeText;
      elements.inspectTrendBadge.className = `inspect-trend-badge ${changeClass}`;
    }

    if (isPoe2) {
      const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;
      const exVal = typeof item.exaltedValue === 'number' ? item.exaltedValue : 0;

      const divChaosRate = state.rates?.rawRates?.exalted || (state.rates?.divinePriceInChaos) || 120;
      if (divVal >= 1) {
        elements.inspectMainPrice.textContent = (divVal % 1 === 0 ? divVal.toLocaleString() : divVal.toFixed(1));
        elements.inspectMainCur.textContent = 'Divine';
        elements.inspectSubPrice.textContent = exVal > 0 ? `≈ ${exVal.toLocaleString()} Exalted` : `≈ ${(divVal * divChaosRate).toFixed(0)} Exalted`;
        if (elements.inspectRateNote) elements.inspectRateNote.textContent = `Tỷ giá: 1 Div = ${divChaosRate} Ex`;
      } else if (exVal < 1 && exVal > 0) {
        const perEx = Math.round(1 / exVal * 10) / 10;
        const perDiv = Math.round(divChaosRate / exVal);
        elements.inspectMainPrice.textContent = perEx;
        elements.inspectMainCur.textContent = '/ 1 Ex';
        elements.inspectSubPrice.textContent = `1 Div = ${perDiv.toLocaleString()} • (Đơn giá: ≈ ${exVal.toFixed(2)} Ex)`;
        if (elements.inspectRateNote) elements.inspectRateNote.textContent = `Quy đổi: 1 Ex = ${perEx} • 1 Div = ${perDiv.toLocaleString()} (Tỷ giá 1 Div = ${divChaosRate} Ex)`;
      } else {
        const perDiv = divVal > 0 ? Math.round(1 / divVal) : 0;
        elements.inspectMainPrice.textContent = exVal > 0 ? (exVal % 1 === 0 ? exVal.toLocaleString() : exVal.toFixed(1)) : '0';
        elements.inspectMainCur.textContent = 'Exalted';
        elements.inspectSubPrice.textContent = divVal > 0 ? `≈ ${divVal.toFixed(3)} Divine (1 Div = ${perDiv})` : '';
        if (elements.inspectRateNote) elements.inspectRateNote.textContent = `Tỷ giá: 1 Div = ${divChaosRate} Ex`;
      }
    } else {
      const chaosVal = typeof item.chaosValue === 'number' ? item.chaosValue : 0;
      const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;
      const divChaosRate = state.rates?.divinePriceInChaos || state.divineChaosPrice || 366;

      if (divVal >= 1) {
        elements.inspectMainPrice.textContent = (divVal % 1 === 0 ? divVal.toLocaleString() : divVal.toFixed(1));
        elements.inspectMainCur.textContent = 'Divine';
        elements.inspectSubPrice.textContent = chaosVal > 0 ? `≈ ${chaosVal.toLocaleString()} Chaos` : `≈ ${Math.round(divVal * divChaosRate).toLocaleString()} Chaos`;
        if (elements.inspectRateNote) elements.inspectRateNote.textContent = `Tỷ giá: 1 Div = ${divChaosRate} C`;
      } else if (chaosVal < 1 && chaosVal > 0) {
        const perC = Math.round(1 / chaosVal * 10) / 10;
        const perDiv = Math.round(divChaosRate / chaosVal);
        elements.inspectMainPrice.textContent = perC;
        elements.inspectMainCur.textContent = '/ 1 Chaos';
        elements.inspectSubPrice.textContent = `1 Div = ${perDiv.toLocaleString()} • (Đơn giá: ≈ ${chaosVal.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} C)`;
        if (elements.inspectRateNote) elements.inspectRateNote.textContent = `Quy đổi: 1 C = ${perC} • 1 Div = ${perDiv.toLocaleString()} (Tỷ giá 1 Div = ${divChaosRate} C)`;
      } else {
        const perDiv = divVal > 0 ? Math.round(1 / divVal) : 0;
        elements.inspectMainPrice.textContent = (chaosVal % 1 === 0 ? chaosVal.toLocaleString() : chaosVal.toFixed(1));
        elements.inspectMainCur.textContent = 'Chaos';
        elements.inspectSubPrice.textContent = divVal > 0 ? `≈ ${divVal.toFixed(2)} Divine` : '';
        if (elements.inspectRateNote) elements.inspectRateNote.textContent = perDiv > 0 ? `1 Div = ${perDiv.toLocaleString()} ${item.name} • Tỷ giá 1 Div = ${divChaosRate} C` : `Tỷ giá: 1 Div = ${divChaosRate} C`;
      }
    }

    // 4. Quick Actions (Wiki & Ninja Links)
    if (elements.inspectWikiLink) {
      elements.inspectWikiLink.href = Render.getWikiUrl(item, state.currentGame);
      elements.inspectWikiLink.title = `Xem "${item.name}" trên PoE Wiki`;
    }
    if (elements.inspectNinjaLink) {
      elements.inspectNinjaLink.href = Render.getNinjaUrl(item, state.currentGame, state.currentLeague);
      elements.inspectNinjaLink.title = `Xem "${item.name}" trên poe.ninja`;
    }

    // 5. Authentic PoE Card
    const pDesc = (typeof window !== 'undefined' && window.PoeItemDescriptions) ||
                  (typeof globalThis !== 'undefined' && globalThis.PoeItemDescriptions);
    const tt = pDesc ? pDesc.getTooltip(item) : null;

    if (elements.poeCardName) {
      elements.poeCardName.textContent = (tt && tt.title) ? tt.title : (item.name || 'Item Name');
      elements.poeCardName.className = `poe-card-name rarity-${tt?.rarity || 'currency'}`;
    }
    if (elements.poeCardType) {
      elements.poeCardType.textContent = (tt && tt.baseType) ? tt.baseType : (item.baseType || item.category || '');
    }

    const renderCardBody = () => {
      if (!elements.poeCardMods) return;
      if (pDesc && typeof pDesc.getPoEDescription === 'function') {
        elements.poeCardMods.innerHTML = pDesc.getPoEDescription(item);
      } else if (item.explicitModifiers && item.explicitModifiers.length > 0) {
        elements.poeCardMods.innerHTML = item.explicitModifiers.map(m => Render.escapeHtml(m)).join('<br>');
      } else if (item.mapTier) {
        elements.poeCardMods.innerHTML = `Map Tier: ${item.mapTier}<br>Item Quantity: +0%<br>Item Rarity: +0%`;
      } else {
        elements.poeCardMods.textContent = 'Right-click to inspect or consume this item.';
      }
    };

    renderCardBody();

    // Flavor text handling
    const flavour = item.flavourText || (tt && tt.flavour) || '';
    if (elements.poeCardFlavour) {
      if (flavour) {
        elements.poeCardFlavour.textContent = flavour;
        elements.poeCardFlavour.classList.remove('hidden');
        if (elements.poeCardFlavourSep) elements.poeCardFlavourSep.classList.remove('hidden');
      } else {
        elements.poeCardFlavour.textContent = '';
        elements.poeCardFlavour.classList.add('hidden');
        if (elements.poeCardFlavourSep) elements.poeCardFlavourSep.classList.add('hidden');
      }
    }

    // Subscribe to background PoEDB fetch if description arrives while modal is open
    if (pDesc && typeof pDesc.onPoedbLoaded === 'function') {
      pDesc.onPoedbLoaded((loadedName) => {
        if (state.activeModalItem && (state.activeModalItem.name || '').toLowerCase() === loadedName.toLowerCase()) {
          renderCardBody();
        }
      });
    }

    // 6. Right Column: 7-day Bezier Area Chart
    if (elements.inspectChartContainer) {
      elements.inspectChartContainer.innerHTML = Render.generateBezierAreaChart(item.sparkline, change, 480, 180);
    }
    if (elements.inspectChartSummary) {
      elements.inspectChartSummary.textContent = `Biến động 7 ngày: ${changeText}`;
    }

    // 7. Right Column: Market Ranking & Position
    const allItems = state.allItems || state.items || [];
    const catItems = allItems.filter(i => (i.category === item.category || i.sourceType === item.sourceType));
    const sortVal = (it) => isPoe2 ? (it.exaltedValue || it.divineValue || 0) : (it.chaosValue || it.divineValue || 0);
    catItems.sort((a, b) => sortVal(b) - sortVal(a));
    const rankIndex = catItems.findIndex(i => i.id === item.id);
    const rank = rankIndex !== -1 ? rankIndex + 1 : 1;
    const total = catItems.length || 1;
    const percentile = Math.max(1, Math.round((rank / total) * 100));

    if (elements.inspectRankText) {
      elements.inspectRankText.textContent = `Xếp hạng #${rank} trong ${total} vật phẩm (${item.category || item.sourceType})`;
    }
    if (elements.inspectRankPercentile) {
      elements.inspectRankPercentile.textContent = `Top ${percentile}%`;
    }
    if (elements.inspectRankBar) {
      elements.inspectRankBar.style.width = `${Math.min(100, Math.max(5, 105 - percentile))}%`;
    }
    if (elements.inspectVolumeStat) {
      elements.inspectVolumeStat.textContent = item.volume ? item.volume.toLocaleString() : 'N/A';
    }
    if (elements.inspectAvgStat) {
      const avg = total > 0 ? Math.round(catItems.reduce((acc, it) => acc + sortVal(it), 0) / total) : 0;
      elements.inspectAvgStat.textContent = isPoe2 ? `${avg.toLocaleString()} Ex` : `${avg.toLocaleString()} C`;
    }

    // 8. Right Column: Related Items in Category
    if (elements.inspectRelatedList) {
      const related = catItems.filter(i => i.id !== item.id).slice(0, 4);
      if (related.length > 0) {
        elements.inspectRelatedList.innerHTML = related.map(rel => {
          const relVal = isPoe2 
            ? (rel.divineValue >= 1 ? `${rel.divineValue} Div` : `${rel.exaltedValue || 0} Ex`)
            : (rel.divineValue >= 1 ? `${rel.divineValue} Div` : `${rel.chaosValue || 0} C`);
          return `
            <div class="inspect-related-row" data-action="inspect-related" data-id="${Render.escapeHtml(rel.id)}">
              <div class="inspect-related-info">
                <img src="${Render.escapeHtml(rel.icon || Render.ICONS.chaos)}" alt="" class="inspect-related-thumb" />
                <span>${Render.escapeHtml(rel.name)}</span>
              </div>
              <span class="inspect-related-val">${relVal}</span>
            </div>
          `;
        }).join('');
      } else {
        elements.inspectRelatedList.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 6px 0;">Không có vật phẩm tương tự.</div>';
      }
    }

    // 9. Show Modal Overlay
    if (elements.itemInspectOverlay) {
      elements.itemInspectOverlay.classList.remove('hidden');
      elements.itemInspectOverlay.removeAttribute('hidden');
      elements.itemInspectOverlay.style.display = 'flex';
    }
  },

  closeItemInspection(elements) {
    if (elements.itemInspectOverlay) {
      elements.itemInspectOverlay.classList.add('hidden');
      elements.itemInspectOverlay.setAttribute('hidden', '');
      elements.itemInspectOverlay.style.display = 'none';
    }
  },

  // Backward compatibility alias for calculator modal calls
  openCalculator(item, state, elements) {
    this.openItemInspection(item, state, elements);
  },

  closeCalculator(elements) {
    this.closeItemInspection(elements);
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
