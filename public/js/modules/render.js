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
   * Currency Sprite URLs
   */
  ICONS: {
    chaos: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjF9XQ/46a2347805/CurrencyRerollRare.png',
    divine: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MX1d/ec48896769/CurrencyModValues.png',
    exalted: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MX1d/680327f32d/CurrencyAddModToRare.png',
    mirror: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lEdXBsaWNhdGUiLCJzY2FsZSI6MX1d/8d7fea29d1/CurrencyDuplicate.png'
  },

  /**
   * Format Value Cell in Faustus Exchange Style
   */
  formatValueHtml(item, game) {
    const itemIcon = item.icon || this.ICONS.chaos;

    if (game === 'poe2') {
      const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;
      const exVal = typeof item.exaltedValue === 'number' ? item.exaltedValue : 0;

      if (divVal >= 1) {
        const divFormatted = divVal >= 1000 ? (divVal / 1000).toFixed(1) + 'k' : divVal.toLocaleString();
        return `
          <div class="exchange-pair">
            <span class="val-primary">${divFormatted}</span>
            <img src="${this.ICONS.divine}" class="mini-ico" alt="Div" title="Divine Orb" />
            <span class="exchange-arrow">⇆</span>
            <span class="val-base">1.0</span>
            <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
          </div>
          ${exVal > 0 ? `<div class="val-sub">≈ ${exVal.toLocaleString()} Ex</div>` : ''}
        `;
      }

      const exFormatted = exVal >= 1000 ? (exVal / 1000).toFixed(1) + 'k' : (exVal % 1 === 0 ? exVal.toLocaleString() : exVal.toFixed(1));
      return `
        <div class="exchange-pair">
          <span class="val-primary">${exFormatted}</span>
          <img src="${this.ICONS.exalted}" class="mini-ico" alt="Ex" title="Exalted Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">1.0</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        ${divVal > 0 ? `<div class="val-sub">≈ ${divVal.toFixed(3)} Div</div>` : ''}
      `;
    }

    // PoE 1
    const chaosVal = typeof item.chaosValue === 'number' ? item.chaosValue : 0;
    const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;

    if (divVal >= 1) {
      const divFormatted = divVal >= 1000 ? (divVal / 1000).toFixed(1) + 'k' : divVal.toLocaleString();
      return `
        <div class="exchange-pair">
          <span class="val-primary">${divFormatted}</span>
          <img src="${this.ICONS.divine}" class="mini-ico" alt="Div" title="Divine Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">1.0</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        ${chaosVal > 0 ? `<div class="val-sub">≈ ${chaosVal.toLocaleString()} C</div>` : ''}
      `;
    }

    const chaosFormatted = chaosVal >= 1000 ? (chaosVal / 1000).toFixed(1) + 'k' : (chaosVal % 1 === 0 ? chaosVal.toLocaleString() : chaosVal.toFixed(1));
    return `
      <div class="exchange-pair">
        <span class="val-primary">${chaosFormatted}</span>
        <img src="${this.ICONS.chaos}" class="mini-ico" alt="C" title="Chaos Orb" />
        <span class="exchange-arrow">⇆</span>
        <span class="val-base">1.0</span>
        <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
      </div>
      ${divVal > 0 ? `<div class="val-sub">≈ ${divVal.toFixed(2)} Div</div>` : ''}
    `;
  },

  /**
   * Format Volume Cell
   */
  formatVolumeHtml(item, game) {
    const vol = typeof item.volume === 'number' ? item.volume : 0;
    if (vol <= 0) return '<span class="volume-num text-muted">-</span>';

    const formatted = vol >= 1000000 ? (vol / 1000000).toFixed(1) + 'M' : vol >= 1000 ? (vol / 1000).toFixed(1) + 'k' : vol.toLocaleString();
    const isPoe2 = game === 'poe2';
    const currIcon = isPoe2 ? (item.divineValue >= 1 ? this.ICONS.divine : this.ICONS.exalted) : (item.divineValue >= 1 ? this.ICONS.divine : this.ICONS.chaos);

    return `
      <div class="volume-display">
        <span class="volume-num">${formatted}</span>
        <img src="${currIcon}" class="mini-ico" alt="" />
        ${this.renderLiquidityBadge(vol)}
      </div>
    `;
  },

  /**
   * Get direct PoE Wiki URL
   */
  getWikiUrl(item, game) {
    if (typeof window !== 'undefined' && window.PoeItemDescriptions) {
      return window.PoeItemDescriptions.getWikiUrl(item);
    }
    return game === 'poe2'
      ? `https://poe2db.tw/us/${encodeURIComponent(item.name)}`
      : `https://www.poewiki.net/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}`;
  },

  /**
   * Render Table Rows (Zero inline handlers, Zero inline onerror)
   */
  renderTableRows(items, state) {
    const hasQuery = Boolean(state && state.searchQuery && state.searchQuery.trim());

    if (!items || items.length === 0) {
      return `
        <tr>
          <td colspan="5" class="empty-table-cell">
            <div class="empty-state">
              <i class="fa-solid fa-box-open empty-icon"></i>
              <p class="empty-title">${hasQuery ? `Không tìm thấy vật phẩm cho "${this.escapeHtml(state.searchQuery)}"` : 'Không tìm thấy vật phẩm nào'}</p>
              <p class="empty-desc">${hasQuery ? 'Kiểm tra chính tả hoặc thử tìm kiếm với từ khóa ngắn hơn.' : 'Thử chuyển danh mục hoặc tắt bộ lọc.'}</p>
              ${hasQuery ? `
                <button class="btn-clear-search-empty" data-action="clear-search">
                  <i class="fa-solid fa-rotate-left"></i> Xóa tìm kiếm
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }

    return items.map(item => {
      const isFav = state.isFavorite(item.id);
      const isComparing = state.isInCompare(item.id);
      const change = typeof item.change7d === 'number' ? item.change7d : 0;
      const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
      const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      const iconUrl = item.icon || this.ICONS.chaos;

      let rarityClass = 'rarity-currency';
      const cat = (item.category || '').toLowerCase();
      if (cat.includes('card')) rarityClass = 'rarity-divination';
      else if (cat.includes('gem')) rarityClass = 'rarity-gem';
      else if (cat.includes('unique')) rarityClass = 'rarity-unique';

      const wikiUrl = this.getWikiUrl(item, state.currentGame);
      const showCategoryBadge = hasQuery;

      return `
        <tr class="item-table-row ${isComparing ? 'row-comparing' : ''}" data-id="${this.escapeHtml(item.id)}">
          <td class="col-name">
            <div class="table-name-cell">
              <button class="star-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}" title="${isFav ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}">★</button>
              <img src="${this.escapeHtml(iconUrl)}" alt="" class="table-item-icon" loading="lazy" data-tooltip-id="${this.escapeHtml(item.id)}">
              <div class="table-name-wrap">
                <span class="item-link-name ${rarityClass}" data-action="open-calc" data-id="${this.escapeHtml(item.id)}" data-tooltip-id="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</span>
                ${showCategoryBadge ? `<span class="table-cat-badge">${this.escapeHtml(item.category || item.sourceType)}</span>` : ''}
                <a href="${wikiUrl}" target="_blank" rel="noopener" class="wiki-badge" title="Tra cứu PoE Wiki">WIKI ↗</a>
              </div>
            </div>
          </td>
          <td class="col-val text-right" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            ${this.formatValueHtml(item, state.currentGame)}
          </td>
          <td class="col-trend text-center" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            <div class="trend-cell-wrapper">
              <div class="sparkline-wrapper">
                ${this.renderSparkline(item.sparkline, change)}
              </div>
              <span class="trend-badge ${changeClass}">${changeText}</span>
            </div>
          </td>
          <td class="col-volume text-right hide-sm" data-action="open-calc" data-id="${this.escapeHtml(item.id)}">
            ${this.formatVolumeHtml(item, state.currentGame)}
          </td>
          <td class="col-actions text-center">
            <div class="table-actions-group">
              <button class="action-quick-btn btn-calc" data-action="open-calc" data-id="${this.escapeHtml(item.id)}" title="Mở máy tính giá">
                <i class="fa-solid fa-calculator"></i>
              </button>
              <button class="action-quick-btn btn-compare ${isComparing ? 'active' : ''}" data-action="toggle-compare" data-id="${this.escapeHtml(item.id)}" title="${isComparing ? 'Xóa khỏi so sánh' : 'So sánh vật phẩm'}">
                <i class="fa-solid fa-code-compare"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Render Grid Cards (Zero inline handlers, Zero inline onerror)
   */
  renderGridCards(items, state) {
    const hasQuery = Boolean(state && state.searchQuery && state.searchQuery.trim());

    if (!items || items.length === 0) {
      return `
        <div class="empty-state grid-span-full">
          <i class="fa-solid fa-box-open empty-icon"></i>
          <p class="empty-title">${hasQuery ? `Không tìm thấy vật phẩm cho "${this.escapeHtml(state.searchQuery)}"` : 'Không tìm thấy vật phẩm nào'}</p>
          <p class="empty-desc">${hasQuery ? 'Kiểm tra chính tả hoặc thử tìm kiếm với từ khóa ngắn hơn.' : 'Thử chuyển danh mục hoặc tắt bộ lọc.'}</p>
          ${hasQuery ? `
            <button class="btn-clear-search-empty" data-action="clear-search">
              <i class="fa-solid fa-rotate-left"></i> Xóa tìm kiếm
            </button>
          ` : ''}
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
      const wikiUrl = this.getWikiUrl(item, state.currentGame);

      return `
        <div class="item-grid-card ${isComparing ? 'card-comparing' : ''}" data-id="${this.escapeHtml(item.id)}">
          <div class="card-header-bar">
            <button class="star-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}" title="${isFav ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}">★</button>
            <span class="item-category-tag">${this.escapeHtml(item.category)}</span>
            ${this.renderLiquidityBadge(item.volume)}
          </div>
          <div class="card-body" data-action="open-calc" data-id="${this.escapeHtml(item.id)}" data-tooltip-id="${this.escapeHtml(item.id)}">
            <div class="grid-item-thumb-wrapper" data-tooltip-id="${this.escapeHtml(item.id)}">
              <img src="${this.escapeHtml(iconUrl)}" alt="" class="grid-item-thumb" loading="lazy" data-tooltip-id="${this.escapeHtml(item.id)}">
            </div>
            <div class="grid-item-name" data-tooltip-id="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</div>
            <div class="grid-item-price">
              ${this.formatValueHtml(item, state.currentGame)}
            </div>
            <div class="grid-item-trend">
              <span class="trend-pill ${changeClass}">${changeText}</span>
              ${this.renderSparkline(item.sparkline, change)}
            </div>
          </div>
          <div class="card-footer-actions">
            <button class="btn-card-calc" data-action="open-calc" data-id="${this.escapeHtml(item.id)}" title="Mở máy tính giá">
              <i class="fa-solid fa-calculator"></i> Tính giá
            </button>
            <a href="${wikiUrl}" target="_blank" rel="noopener" class="btn-card-wiki" title="Tra cứu PoE Wiki">
              <i class="fa-solid fa-book-open"></i>
            </a>
            <button class="btn-card-compare ${isComparing ? 'active' : ''}" data-action="toggle-compare" data-id="${this.escapeHtml(item.id)}" title="${isComparing ? 'Xóa khỏi so sánh' : 'So sánh vật phẩm'}">
              <i class="fa-solid fa-code-compare"></i>
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
