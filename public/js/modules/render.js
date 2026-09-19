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
   * Render Smooth Cubic Bezier Area Chart with Gradient Fill (POESTASH style)
   */
  generateBezierAreaChart(data = [], change = 0, width = 480, height = 180) {
    if (!data || data.length < 2) {
      return `
        <div class="empty-chart-state" style="text-align: center; color: #64748b; font-size: 0.85rem; padding: 40px 0;">
          <i class="fa-solid fa-chart-line" style="font-size: 1.8rem; margin-bottom: 8px; opacity: 0.5; display: block;"></i>
          Chưa có dữ liệu biến động giá 7 ngày
        </div>
      `;
    }

    const padding = { top: 20, right: 25, bottom: 30, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || (min > 0 ? min * 0.1 : 1);

    const points = data.map((val, idx) => {
      const x = padding.left + (idx / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((val - min) / range) * chartH;
      return { x, y, val };
    });

    // Generate smooth cubic Bezier path
    let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const tension = 0.2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + chartH} L ${points[0].x.toFixed(1)} ${padding.top + chartH} Z`;

    const strokeColor = change > 0 ? '#4ade80' : change < 0 ? '#f87171' : '#f2a93b';
    const fillGradientStart = change > 0 ? 'rgba(74, 222, 128, 0.35)' : change < 0 ? 'rgba(248, 113, 113, 0.35)' : 'rgba(242, 169, 59, 0.35)';
    const fillGradientEnd = change > 0 ? 'rgba(74, 222, 128, 0.01)' : change < 0 ? 'rgba(248, 113, 113, 0.01)' : 'rgba(242, 169, 59, 0.01)';
    const gradId = `chart-grad-${Math.random().toString(36).substring(2, 8)}`;

    const mid = (min + max) / 2;
    const formatLabel = (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : (v >= 10 ? v.toFixed(0) : v.toFixed(1));

    const gridLines = [
      { y: padding.top, label: formatLabel(max) },
      { y: padding.top + chartH / 2, label: formatLabel(mid) },
      { y: padding.top + chartH, label: formatLabel(min) }
    ];

    const gridSvg = gridLines.map(g => `
      <line x1="${padding.left}" y1="${g.y}" x2="${width - padding.right}" y2="${g.y}" class="chart-grid-line" />
      <text x="${padding.left - 8}" y="${g.y + 3}" text-anchor="end" class="chart-label-text">${g.label}</text>
    `).join('');

    const daysLabels = ['7d', '6d', '5d', '4d', '3d', '2d', 'Hôm nay'];
    const xLabels = points.map((p, idx) => {
      const dayLabel = daysLabels[idx] || `${idx + 1}d`;
      return `<text x="${p.x.toFixed(1)}" y="${padding.top + chartH + 18}" text-anchor="middle" class="chart-label-text">${dayLabel}</text>`;
    }).join('');

    const dots = points.map(p => `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${strokeColor}" stroke="#0b0e16" stroke-width="1.5" />
    `).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="inspect-svg-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fillGradientStart}" />
            <stop offset="100%" stop-color="${fillGradientEnd}" />
          </linearGradient>
        </defs>
        ${gridSvg}
        <path d="${areaD}" fill="url(#${gradId})" />
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${dots}
        ${xLabels}
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
   * Format Value Cell in Faustus Exchange / poe.ninja Style
   * Flexible exchange ratio: inverts when item < 1 base currency (e.g. 1.0 C ⇆ 36 Lifeforce, 1.0 C ⇆ 1.1 Bauble)
   */
  formatValueHtml(item, game, rates) {
    const itemIcon = item.icon || this.ICONS.chaos;
    const isPoe2 = game === 'poe2';

    if (isPoe2) {
      const exVal = typeof item.exaltedValue === 'number' ? item.exaltedValue : 0;
      const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;

      // Expensive PoE 2 item (>= 1 Exalted)
      if (exVal >= 1) {
        const exFormatted = exVal >= 1000 ? (exVal / 1000).toFixed(1) + 'k' : (exVal % 1 === 0 ? exVal.toLocaleString() : exVal.toFixed(1));
        return `
          <div class="exchange-pair">
            <span class="val-primary">${exFormatted}</span>
            <img src="${this.ICONS.exalted}" class="mini-ico" alt="Ex" title="Exalted Orb" />
            <span class="exchange-arrow">⇆</span>
            <span class="val-base">1.0</span>
            <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
          </div>
          ${divVal > 0 ? `<div class="val-sub">≈ ${divVal >= 1 ? (divVal % 1 === 0 ? divVal.toLocaleString() : divVal.toFixed(1)) : divVal.toFixed(2)} Div</div>` : ''}
        `;
      }

      // Fractional PoE 2 item (< 1 Exalted): Invert ratio to show how many items per 1 Exalted!
      if (exVal > 0) {
        const unitsPerEx = 1 / exVal;
        const unitsFormatted = unitsPerEx >= 1000 ? (unitsPerEx / 1000).toFixed(1) + 'k' : (unitsPerEx >= 10 ? Math.round(unitsPerEx).toLocaleString() : unitsPerEx.toFixed(1));
        return `
          <div class="exchange-pair">
            <span class="val-primary">1.0</span>
            <img src="${this.ICONS.exalted}" class="mini-ico" alt="Ex" title="Exalted Orb" />
            <span class="exchange-arrow">⇆</span>
            <span class="val-base">${unitsFormatted}</span>
            <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
          </div>
          <div class="val-sub">1 ${this.escapeHtml(item.name)} ≈ ${exVal.toFixed(2)} Ex</div>
        `;
      }

      return `<div class="exchange-pair"><span class="val-primary text-muted">-</span></div>`;
    }

    // PoE 1
    const chaosVal = typeof item.chaosValue === 'number' ? item.chaosValue : 0;
    const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;

    // Item >= 1 Chaos
    if (chaosVal >= 1) {
      const chaosFormatted = chaosVal >= 1000 ? (chaosVal / 1000).toFixed(1) + 'k' : (chaosVal % 1 === 0 ? chaosVal.toLocaleString() : chaosVal.toFixed(1));
      return `
        <div class="exchange-pair">
          <span class="val-primary">${chaosFormatted}</span>
          <img src="${this.ICONS.chaos}" class="mini-ico" alt="C" title="Chaos Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">1.0</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        ${divVal > 0 ? `<div class="val-sub">≈ ${divVal >= 1 ? (divVal % 1 === 0 ? divVal.toLocaleString() : divVal.toFixed(1)) : divVal.toFixed(2)} Div</div>` : ''}
      `;
    }

    // Fractional item (< 1 Chaos): Invert ratio to show how many per 1 Chaos (e.g. 1.0 C ⇆ 36 Lifeforce, 1.0 C ⇆ 1.1 Bauble)!
    if (chaosVal > 0) {
      const unitsPerChaos = 1 / chaosVal;
      const unitsFormatted = unitsPerChaos >= 1000 ? (unitsPerChaos / 1000).toFixed(1) + 'k' : (unitsPerChaos >= 10 ? Math.round(unitsPerChaos).toLocaleString() : unitsPerChaos.toFixed(1));
      return `
        <div class="exchange-pair">
          <span class="val-primary">1.0</span>
          <img src="${this.ICONS.chaos}" class="mini-ico" alt="C" title="Chaos Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">${unitsFormatted}</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        <div class="val-sub">1 ${this.escapeHtml(item.name)} ≈ ${chaosVal.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} C</div>
      `;
    }

    return `<div class="exchange-pair"><span class="val-primary text-muted">-</span></div>`;
  },

  /**
   * Format Most Popular Column (poe.ninja Authentic)
   * Shows the most active trading denomination (e.g. 1.0 Div ⇆ 13k Lifeforce, 1.0 Div ⇆ 409 Bauble, 55 C ⇆ 1.0 Chisel)
   */
  formatMostPopularHtml(item, game, rates) {
    const itemIcon = item.icon || this.ICONS.chaos;
    const isPoe2 = game === 'poe2';

    if (isPoe2) {
      const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;
      const exVal = typeof item.exaltedValue === 'number' ? item.exaltedValue : 0;
      const exRate = (rates && rates.rawRates && typeof rates.rawRates.exalted === 'number' && rates.rawRates.exalted > 0)
        ? rates.rawRates.exalted
        : (divVal > 0 && exVal > 0 ? Math.round(exVal / divVal) : 0);

      // 1. Expensive items (>= 1 Divine)
      if (divVal >= 1) {
        const divFormatted = divVal >= 1000 ? (divVal / 1000).toFixed(1) + 'k' : (divVal % 1 === 0 ? divVal.toLocaleString() : divVal.toFixed(1));
        return `
          <div class="exchange-pair popular-pair">
            <span class="val-primary val-gold">${divFormatted}</span>
            <img src="${this.ICONS.divine}" class="mini-ico" alt="Div" title="Divine Orb" />
            <span class="exchange-arrow">⇆</span>
            <span class="val-base">1.0</span>
            <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
          </div>
          ${exRate > 0 ? `<div class="val-sub">≈ ${Math.round(divVal * exRate).toLocaleString()} Ex</div>` : ''}
        `;
      }

      // 2. High Exalted item (>= 15 Exalted, traded per unit in Exalted)
      if (exVal >= 15) {
        const exFormatted = exVal >= 1000 ? (exVal / 1000).toFixed(1) + 'k' : (exVal % 1 === 0 ? exVal.toLocaleString() : exVal.toFixed(1));
        return `
          <div class="exchange-pair popular-pair">
            <span class="val-primary">${exFormatted}</span>
            <img src="${this.ICONS.exalted}" class="mini-ico" alt="Ex" title="Exalted Orb" />
            <span class="exchange-arrow">⇆</span>
            <span class="val-base">1.0</span>
            <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
          </div>
          ${divVal > 0 ? `<div class="val-sub">≈ ${divVal.toFixed(2)} Div</div>` : ''}
        `;
      }

      // 3. Bulk items (< 15 Exalted): Traded in bulk Divine!
      if (exVal > 0 && exRate > 0) {
        const unitsPerDiv = exRate / exVal;
        const unitsFormatted = unitsPerDiv >= 1000000 ? (unitsPerDiv / 1000000).toFixed(1) + 'M' : (unitsPerDiv >= 1000 ? (unitsPerDiv / 1000).toFixed(1) + 'k' : (unitsPerDiv >= 10 ? Math.round(unitsPerDiv).toLocaleString() : unitsPerDiv.toFixed(1)));
        return `
          <div class="exchange-pair popular-pair">
            <span class="val-primary val-gold">1.0</span>
            <img src="${this.ICONS.divine}" class="mini-ico" alt="Div" title="Divine Orb" />
            <span class="exchange-arrow">⇆</span>
            <span class="val-base">${unitsFormatted}</span>
            <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
          </div>
          <div class="val-sub">1 Div = ${Math.round(unitsPerDiv).toLocaleString()}</div>
        `;
      }

      return `<div class="exchange-pair"><span class="val-primary text-muted">-</span></div>`;
    }

    // PoE 1
    const chaosVal = typeof item.chaosValue === 'number' ? item.chaosValue : 0;
    const divVal = typeof item.divineValue === 'number' ? item.divineValue : 0;
    const divChaosRate = (rates && typeof rates.divinePriceInChaos === 'number' && rates.divinePriceInChaos > 0)
      ? rates.divinePriceInChaos
      : (divVal > 0 && chaosVal > 0 ? Math.round(chaosVal / divVal) : 0);

    // 1. Expensive items (>= 1 Divine)
    if (divVal >= 1) {
      const divFormatted = divVal >= 1000 ? (divVal / 1000).toFixed(1) + 'k' : (divVal % 1 === 0 ? divVal.toLocaleString() : divVal.toFixed(1));
      return `
        <div class="exchange-pair popular-pair">
          <span class="val-primary val-gold">${divFormatted}</span>
          <img src="${this.ICONS.divine}" class="mini-ico" alt="Div" title="Divine Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">1.0</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        ${divChaosRate > 0 ? `<div class="val-sub">≈ ${Math.round(divVal * divChaosRate).toLocaleString()} C</div>` : ''}
      `;
    }

    // 2. High Chaos item (>= 15 Chaos and < 1 Divine, e.g. 50C Sacred Lifeforce, 55C Maven Chisel)
    if (chaosVal >= 15) {
      const chaosFormatted = chaosVal >= 1000 ? (chaosVal / 1000).toFixed(1) + 'k' : (chaosVal % 1 === 0 ? chaosVal.toLocaleString() : chaosVal.toFixed(1));
      return `
        <div class="exchange-pair popular-pair">
          <span class="val-primary">${chaosFormatted}</span>
          <img src="${this.ICONS.chaos}" class="mini-ico" alt="C" title="Chaos Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">1.0</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        ${divVal > 0 ? `<div class="val-sub">≈ ${divVal.toFixed(2)} Div</div>` : ''}
      `;
    }

    // 3. Bulk items (< 15 Chaos, e.g. 0.89 C Bauble, 0.027 C Lifeforce, 2 C Essences, 5 C Scarabs)
    // Most popular trade on the market is 1 Divine worth of bulk!
    if (chaosVal > 0 && divChaosRate > 0) {
      const unitsPerDiv = divChaosRate / chaosVal;
      const unitsFormatted = unitsPerDiv >= 1000000 ? (unitsPerDiv / 1000000).toFixed(1) + 'M' : (unitsPerDiv >= 1000 ? (unitsPerDiv / 1000).toFixed(1) + 'k' : (unitsPerDiv >= 10 ? Math.round(unitsPerDiv).toLocaleString() : unitsPerDiv.toFixed(1)));
      return `
        <div class="exchange-pair popular-pair">
          <span class="val-primary val-gold">1.0</span>
          <img src="${this.ICONS.divine}" class="mini-ico" alt="Div" title="Divine Orb" />
          <span class="exchange-arrow">⇆</span>
          <span class="val-base">${unitsFormatted}</span>
          <img src="${this.escapeHtml(itemIcon)}" class="mini-ico" alt="" />
        </div>
        <div class="val-sub">1 Div = ${Math.round(unitsPerDiv).toLocaleString()}</div>
      `;
    }

    return `<div class="exchange-pair"><span class="val-primary text-muted">-</span></div>`;
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
   * Get authentic poe.ninja economy URL (PoE 1 has NO /poe1/ in web URL, uses kebab-case plural slugs)
   */
  getNinjaUrl(item, game = 'poe1', league = 'Standard') {
    if (!item) return 'https://poe.ninja';

    const isPoe2 = game === 'poe2';
    const baseUrl = isPoe2 ? 'https://poe.ninja/poe2/economy' : 'https://poe.ninja/economy';

    let leagueSlug = (league || item.league || 'standard').trim().toLowerCase();
    if (leagueSlug === 'hardcore allflame') leagueSlug = 'allflamehc';
    else leagueSlug = leagueSlug.replace(/\s+/g, '-');

    const typeKey = (item.sourceType || item.category || '').trim();
    const map = {
      // PoE 1
      'Currency': 'currency',
      'Fragment': 'fragments',
      'Fragments': 'fragments',
      'Scarab': 'scarabs',
      'Scarabs': 'scarabs',
      'DivinationCard': 'divination-cards',
      'Divination Cards': 'divination-cards',
      'Artifact': 'artifacts',
      'Artifacts': 'artifacts',
      'Tattoo': 'tattoos',
      'Tattoos': 'tattoos',
      'Omen': 'omens',
      'Omens': 'omens',
      'AllflameEmber': 'allflame-embers',
      'Allflame Embers': 'allflame-embers',
      'Runegraft': 'runegrafts',
      'Runegrafts': 'runegrafts',
      'Map': 'maps',
      'Maps': 'maps',
      'BlightedMap': 'blighted-maps',
      'Blighted Maps': 'blighted-maps',
      'UniqueMap': 'unique-maps',
      'Unique Maps': 'unique-maps',
      'DeliriumOrb': 'delirium-orbs',
      'Delirium Orbs': 'delirium-orbs',
      'Essence': 'essences',
      'Essences': 'essences',
      'Fossil': 'fossils',
      'Fossils': 'fossils',
      'Resonator': 'resonators',
      'Resonators': 'resonators',
      'Oil': 'oils',
      'Oils': 'oils',
      'Invitation': 'invitations',
      'Invitations': 'invitations',
      'Memory': 'memories',
      'Memories': 'memories',
      'Beast': 'beasts',
      'Beasts': 'beasts',
      // PoE 2
      'UncutGems': 'uncut-gems',
      'Uncut Gems': 'uncut-gems',
      'LineageSupportGems': 'lineage-support-gems',
      'Lineage Gems': 'lineage-support-gems',
      'SoulCores': 'soul-cores',
      'Soul Cores': 'soul-cores',
      'Idols': 'idols',
      'Runes': 'runes',
      'Breach': 'breach',
      'Catalysts': 'breach',
      'Delirium': 'delirium',
      'Liquid Emotions': 'delirium',
      'Ritual': 'ritual',
      'Expedition': 'expedition',
      'Abyss': 'abyss',
      'Abyssal Bones': 'abyss'
    };

    const typeSlug = map[typeKey] || typeKey.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\s+/g, '-');
    return `${baseUrl}/${encodeURIComponent(leagueSlug)}/${encodeURIComponent(typeSlug)}`;
  },

  /**
   * Render Table Rows (Zero inline handlers, Zero inline onerror)
   */
  renderTableRows(items, state) {
    const hasQuery = Boolean(state && state.searchQuery && state.searchQuery.trim());

    if (!items || items.length === 0) {
      return `
        <tr>
          <td colspan="6" class="empty-table-cell">
            <div class="empty-state">
              <i class="fa-solid fa-box-open empty-icon"></i>
              <p class="empty-title">${hasQuery ? `Không tìm thấy vật phẩm cho "${this.escapeHtml(state.searchQuery)}"` : `Chưa có dữ liệu cho danh mục "${this.escapeHtml(state.activeCategory || '')}"`}</p>
              <p class="empty-desc">${hasQuery ? 'Kiểm tra chính tả hoặc thử tìm kiếm với từ khóa ngắn hơn.' : 'Nhấn nút bên dưới để tải dữ liệu trực tiếp từ poe.ninja.'}</p>
              ${hasQuery ? `
                <button class="btn-clear-search-empty" data-action="clear-search">
                  <i class="fa-solid fa-rotate-left"></i> Xóa tìm kiếm
                </button>
              ` : `
                <button class="btn-clear-search-empty" data-action="refresh-category-active">
                  <i class="fa-solid fa-arrows-rotate"></i> Tải ngay từ poe.ninja
                </button>
              `}
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
      else if (cat.includes('unique') || cat.includes('uniquemap')) rarityClass = 'rarity-unique';

      const wikiUrl = this.getWikiUrl(item, state.currentGame);
      const showCategoryBadge = hasQuery;
      const subtitle = item.subCategory && item.subCategory !== item.category && item.subCategory !== item.sourceType
        ? item.subCategory
        : (item.variant || '');

      return `
        <tr class="item-table-row ${isComparing ? 'row-comparing' : ''}" data-id="${this.escapeHtml(item.id)}" data-tooltip-id="${this.escapeHtml(item.id)}">
          <td class="col-name">
            <div class="table-name-cell">
              <button class="star-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}" title="${isFav ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}">★</button>
              <img src="${this.escapeHtml(iconUrl)}" alt="" class="table-item-icon" loading="lazy" data-action="open-inspect">
              <div class="table-name-wrap">
                <span class="item-link-name ${rarityClass}" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</span>
                ${subtitle ? `<span class="item-subtext">${this.escapeHtml(subtitle)}</span>` : ''}
                ${showCategoryBadge ? `<span class="table-cat-badge">${this.escapeHtml(item.category || item.sourceType)}</span>` : ''}
                <a href="${wikiUrl}" target="_blank" rel="noopener" class="wiki-badge" title="Tra cứu PoE Wiki">WIKI ↗</a>
              </div>
            </div>
          </td>
          <td class="col-val text-right" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}">
            ${this.formatValueHtml(item, state.currentGame, state.rates)}
          </td>
          <td class="col-trend text-center" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}">
            <div class="trend-cell-wrapper">
              <div class="sparkline-wrapper">
                ${this.renderSparkline(item.sparkline, change)}
              </div>
              <span class="trend-badge ${changeClass}">${changeText}</span>
            </div>
          </td>
          <td class="col-volume text-right hide-sm" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}">
            ${this.formatVolumeHtml(item, state.currentGame)}
          </td>
          <td class="col-popular text-right hide-xs" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}">
            ${this.formatMostPopularHtml(item, state.currentGame, state.rates)}
          </td>
          <td class="col-actions text-center">
            <div class="table-actions-group">
              <button class="action-quick-btn btn-inspect" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}" title="Xem chi tiết & biến động">
                <i class="fa-solid fa-magnifying-glass-chart"></i>
              </button>
              <button class="action-quick-btn btn-whisper" data-action="copy-whisper" data-id="${this.escapeHtml(item.id)}" title="Sao chép whisper">
                <i class="fa-solid fa-copy"></i>
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
        <div class="item-grid-card ${isComparing ? 'card-comparing' : ''}" data-id="${this.escapeHtml(item.id)}" data-tooltip-id="${this.escapeHtml(item.id)}">
          <div class="card-header-bar">
            <button class="star-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${this.escapeHtml(item.id)}" title="${isFav ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}">★</button>
            <span class="item-category-tag">${this.escapeHtml(item.category)}</span>
            ${this.renderLiquidityBadge(item.volume)}
          </div>
          <div class="card-body" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}">
            <div class="grid-item-thumb-wrapper">
              <img src="${this.escapeHtml(iconUrl)}" alt="" class="grid-item-thumb" loading="lazy">
            </div>
            <div class="grid-item-name">${this.escapeHtml(item.name)}</div>
            <div class="grid-item-price">
              ${this.formatValueHtml(item, state.currentGame, state.rates)}
            </div>
            <div class="grid-item-popular">
              <span class="popular-tag">Phổ biến:</span> ${this.formatMostPopularHtml(item, state.currentGame, state.rates)}
            </div>
            <div class="grid-item-trend">
              <span class="trend-pill ${changeClass}">${changeText}</span>
              ${this.renderSparkline(item.sparkline, change)}
            </div>
          </div>
          <div class="card-footer-actions">
            <button class="btn-card-inspect" data-action="open-inspect" data-id="${this.escapeHtml(item.id)}" title="Xem chi tiết & lịch sử giá">
              <i class="fa-solid fa-magnifying-glass-chart"></i> Soi đồ
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
