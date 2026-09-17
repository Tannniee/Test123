/**
 * UI Rendering Module (Zero Inline Handlers, Pure Event Delegation)
 */

export const Render = {
  /**
   * Escape HTML to prevent injection
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Render SVG Sparkline
   */
  renderSparkline(data = [], change = 0) {
    if (!data || data.length < 2) {
      return '<div class="no-sparkline">-</div>';
    }

    const width = 80;
    const height = 24;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const strokeColor = change > 0 ? '#4ade80' : change < 0 ? '#f87171' : '#94a3b8';

    return `
      <svg width="${width}" height="${height}" class="sparkline-svg" viewBox="0 0 ${width} ${height}">
        <polyline fill="none" stroke="${strokeColor}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      </svg>
    `;
  },

  /**
   * Generate Liquidity Badge based on 24h volume
   */
  renderLiquidityBadge(volume) {
    if (!volume || volume <= 0) {
      return '<span class="liquidity-badge badge-zero" title="Ít dữ liệu giao dịch">No Vol</span>';
    }
    if (volume >= 10000) {
      return `<span class="liquidity-badge badge-high" title="Thanh khoản cao (Volume 24h: ${volume.toLocaleString()})">High</span>`;
    }
    if (volume >= 1000) {
      return `<span class="liquidity-badge badge-med" title="Thanh khoản trung bình (Volume 24h: ${volume.toLocaleString()})">Med</span>`;
    }
    return `<span class="liquidity-badge badge-low" title="Thanh khoản thấp (Volume 24h: ${volume.toLocaleString()})">Low</span>`;
  },

  /**
   * Format Value Cell
   */
  formatValueHtml(item, game) {
    if (game === 'poe2') {
      const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;
      const exVal = typeof item.exaltedValue === 'number' ? item.exaltedValue : 0;

      if (divVal >= 1) {
        return `
          <div class="val-primary">${divVal.toLocaleString()} <span class="val-sym div-sym">Div</span></div>
          ${exVal > 0 ? `<div class="val-sub">≈ ${exVal.toLocaleString()} Ex</div>` : ''}
        `;
      }
      return `
        <div class="val-primary">${exVal.toLocaleString()} <span class="val-sym ex-sym">Ex</span></div>
        ${divVal > 0 ? `<div class="val-sub">≈ ${divVal.toFixed(3)} Div</div>` : ''}
      `;
    }

    // PoE 1
    const chaosVal = typeof item.chaosValue === 'number' ? item.chaosValue : 0;
    const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;

    return `
      <div class="val-primary">${chaosVal.toLocaleString()} <span class="val-sym chaos-sym">C</span></div>
      ${divVal > 0 ? `<div class="val-sub">≈ ${divVal} Div</div>` : ''}
    `;
  },

  /**
   * Render Table Rows (Zero inline handlers, Zero inline onerror)
   */
  renderTableRows(items, state) {
    if (!items || items.length === 0) {
      return `
        <tr>
          <td colspan="7" class="empty-table-cell">
            <div class="empty-state">
              <i class="fa-solid fa-box-open empty-icon"></i>
              <p class="empty-title">Không tìm thấy vật phẩm nào</p>
              <p class="empty-desc">Thử tìm kiếm với từ khóa khác hoặc chuyển danh mục.</p>
            </div>
          </td>
        </tr>
      `;
    }

    return items.map(item => {
      const isFav = state.isFavorite(item.id);
      const isComparing = state.isInCompare(item.id);
      const change = typeof item.change7d === 'number' ? item.change7d : 0;
      const changeClass = change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-flat';
      const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      const volumeText = item.volume ? Number(item.volume).toLocaleString() : '-';
      const iconUrl = item.icon || 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png';

      return `
        <tr class="item-table-row ${isComparing ? 'row-comparing' : ''}" data-id="${this.escapeHtml(item.id)}">
          <td class="col-star" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}">
            <button class="star-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}" title="${isFav ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}">★</button>
          </td>
          <td class="col-item" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            <div class="item-identity-cell">
              <div class="item-thumb-wrapper">
                <img src="${this.escapeHtml(iconUrl)}" alt="" class="item-thumb" loading="lazy">
              </div>
              <div class="item-meta-col">
                <span class="item-name-link">${this.escapeHtml(item.name)}</span>
                <div class="item-sub-tags">
                  <span class="item-category-tag">${this.escapeHtml(item.category)}</span>
                  ${this.renderLiquidityBadge(item.volume)}
                </div>
              </div>
            </div>
          </td>
          <td class="col-val text-right" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            ${this.formatValueHtml(item, state.currentGame)}
          </td>
          <td class="col-trend" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            <div class="trend-cell-wrapper">
              <span class="trend-pill ${changeClass}">${changeText}</span>
              <div class="sparkline-wrapper">
                ${this.renderSparkline(item.sparkline, change)}
              </div>
            </div>
          </td>
          <td class="col-volume text-right hide-sm" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            <span class="volume-num">${volumeText}</span>
          </td>
          <td class="col-compare text-center" data-action="toggle-compare" data-id="${this.escapeHtml(item.id)}">
            <label class="compare-checkbox-label">
              <input type="checkbox" class="compare-checkbox" data-action="toggle-compare" data-id="${this.escapeHtml(item.id)}" ${isComparing ? 'checked' : ''}>
              <span class="compare-label-text">So sánh</span>
            </label>
          </td>
          <td class="col-actions text-right">
            <button class="action-quick-btn" data-action="open-calc" data-id="${this.escapeHtml(item.id)}" title="Mở máy tính giá">
              <i class="fa-solid fa-calculator"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Render Grid Cards (Zero inline handlers, Zero inline onerror)
   */
  renderGridCards(items, state) {
    if (!items || items.length === 0) {
      return `
        <div class="empty-state grid-span-full">
          <i class="fa-solid fa-box-open empty-icon"></i>
          <p class="empty-title">Không tìm thấy vật phẩm nào</p>
          <p class="empty-desc">Thử tìm kiếm với từ khóa khác hoặc chuyển danh mục.</p>
        </div>
      `;
    }

    return items.map(item => {
      const isFav = state.isFavorite(item.id);
      const isComparing = state.isInCompare(item.id);
      const change = typeof item.change7d === 'number' ? item.change7d : 0;
      const changeClass = change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-flat';
      const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      const iconUrl = item.icon || 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png';

      return `
        <div class="item-grid-card ${isComparing ? 'card-comparing' : ''}" data-id="${this.escapeHtml(item.id)}">
          <div class="card-header-bar">
            <button class="star-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}" title="Yêu thích">★</button>
            <span class="item-category-tag">${this.escapeHtml(item.category)}</span>
            ${this.renderLiquidityBadge(item.volume)}
          </div>
          <div class="card-body" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            <div class="grid-item-thumb-wrapper">
              <img src="${this.escapeHtml(iconUrl)}" alt="" class="grid-item-thumb" loading="lazy">
            </div>
            <div class="grid-item-name">${this.escapeHtml(item.name)}</div>
            <div class="grid-item-price">
              ${this.formatValueHtml(item, state.currentGame)}
            </div>
            <div class="grid-item-trend">
              <span class="trend-pill ${changeClass}">${changeText}</span>
              ${this.renderSparkline(item.sparkline, change)}
            </div>
          </div>
          <div class="card-footer-actions">
            <label class="compare-checkbox-label">
              <input type="checkbox" class="compare-checkbox" data-action="toggle-compare" data-id="${this.escapeHtml(item.id)}" ${isComparing ? 'checked' : ''}>
              <span>So sánh</span>
            </label>
            <button class="btn-card-calc" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
              <i class="fa-solid fa-calculator"></i> Tính giá
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render Pagination Buttons
   */
  renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    let pages = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    let html = `
      <button class="pg-btn ${currentPage === 1 ? 'disabled' : ''}" data-action="page-prev" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;

    if (start > 1) {
      html += `<button class="pg-btn" data-action="page-goto" data-page="1">1</button>`;
      if (start > 2) html += `<span class="pg-dots">...</span>`;
    }

    for (let i = start; i <= end; i++) {
      html += `
        <button class="pg-btn ${i === currentPage ? 'active' : ''}" data-action="page-goto" data-page="${i}">${i}</button>
      `;
    }

    if (end < totalPages) {
      if (end < totalPages - 1) html += `<span class="pg-dots">...</span>`;
      html += `<button class="pg-btn" data-action="page-goto" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
      <button class="pg-btn ${currentPage === totalPages ? 'disabled' : ''}" data-action="page-next" ${currentPage === totalPages ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    return html;
  }
};
