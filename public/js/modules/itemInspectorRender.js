/**
 * POESTASH Web Item Inspector - Render Engine (Phase 16)
 * Renders rich, interactive Exile-UI style deep analysis views:
 * Affix Tiers, Roll Range Percentiles, Crafting Capacity, Weapon DPS, and Market Valuation.
 */

export const ItemInspectorRender = {
  /**
   * Escape HTML to prevent XSS.
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
   * Format number with commas.
   */
  formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('en-US');
  },

  /**
   * Get rarity CSS class and label.
   */
  getRarityMeta(rarity = 'Normal') {
    const r = (rarity || '').toLowerCase();
    if (r === 'unique') return { cssClass: 'rarity-unique', label: 'Unique', color: '#af6025' };
    if (r === 'rare') return { cssClass: 'rarity-rare', label: 'Rare', color: '#f5c042' };
    if (r === 'magic') return { cssClass: 'rarity-magic', label: 'Magic', color: '#8888ff' };
    if (r === 'currency') return { cssClass: 'rarity-currency', label: 'Currency', color: '#aa9e82' };
    if (r === 'gem') return { cssClass: 'rarity-gem', label: 'Gem', color: '#1ba29b' };
    if (r === 'divination card') return { cssClass: 'rarity-card', label: 'Card', color: '#00e5ff' };
    return { cssClass: 'rarity-normal', label: 'Normal', color: '#c8c8c8' };
  },

  /**
   * Renders the complete Item Inspector inner HTML.
   * @param {Object} data Analysis result from itemAnalyzerService or /api/analyze-item
   * @param {string} [activeTab='affixes'] Currently active tab
   * @returns {string} Rendered HTML string
   */
  renderInspectorModal(data, activeTab = 'affixes') {
    if (!data || !data.item) {
      return '<div class="inspector-empty-state"><p>Không có dữ liệu phân tích.</p></div>';
    }

    const { item, classification = {}, analysis = {}, market = null } = data;
    const identity = item.identity || {};
    const properties = item.properties || {};
    const rarityMeta = this.getRarityMeta(identity.rarity);
    const itemName = identity.name || identity.baseType || 'Unknown Item';
    const baseType = identity.baseType || '';
    const itemClass = identity.itemClass || classification.displayLabel || '';
    const itemLevel = properties.itemLevel;
    const game = item.game || 'poe1';

    return `
      <div class="inspector-container ${rarityMeta.cssClass}">
        <!-- 1. Header Banner -->
        <div class="inspector-header">
          <div class="inspector-title-row">
            <div class="inspector-badge-group">
              <span class="inspector-rarity-pill ${rarityMeta.cssClass}">${this.escapeHtml(rarityMeta.label)}</span>
              <span class="inspector-game-pill">${game.toUpperCase()}</span>
              ${itemLevel !== null && itemLevel !== undefined ? `<span class="inspector-ilvl-pill">iLvl ${itemLevel}</span>` : ''}
              ${classification.kind ? `<span class="inspector-class-pill">${this.escapeHtml(itemClass)}</span>` : ''}
            </div>
            <div class="inspector-quick-links">
              ${market ? `<span class="inspector-market-pill"><i class="fa-solid fa-coins"></i> ${this.escapeHtml(market.name)}: <strong>${market.divineValue >= 1 ? `${market.divineValue} Div` : `${market.chaosValue} C`}</strong></span>` : ''}
            </div>
          </div>

          <h2 class="inspector-item-name ${rarityMeta.cssClass}">${this.escapeHtml(itemName)}</h2>
          ${baseType && baseType !== itemName ? `<div class="inspector-basetype">${this.escapeHtml(baseType)}</div>` : ''}

          <!-- Quick Metrics Ribbon -->
          ${this.renderMetricsRibbon(analysis, market, properties)}
        </div>

        <!-- 2. Tab Navigation -->
        <div class="inspector-nav-tabs">
          <button class="inspector-tab-btn ${activeTab === 'affixes' ? 'active' : ''}" data-tab="affixes">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Affixes &amp; Crafting
          </button>
          <button class="inspector-tab-btn ${activeTab === 'combat' ? 'active' : ''}" data-tab="combat">
            <i class="fa-solid fa-shield-halved"></i> Combat &amp; Defences
          </button>
          <button class="inspector-tab-btn ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
            <i class="fa-solid fa-chart-line"></i> Thị trường &amp; Định giá
          </button>
          <button class="inspector-tab-btn ${activeTab === 'raw' ? 'active' : ''}" data-tab="raw">
            <i class="fa-solid fa-code"></i> Raw Text
          </button>
        </div>

        <!-- 3. Tab Content Panels -->
        <div class="inspector-tab-body">
          <div class="inspector-tab-pane ${activeTab === 'affixes' ? 'active' : ''}" id="pane-affixes">
            ${this.renderAffixesTab(analysis, identity, properties, market)}
          </div>
          <div class="inspector-tab-pane ${activeTab === 'combat' ? 'active' : ''}" id="pane-combat">
            ${this.renderCombatTab(analysis, properties, identity)}
          </div>
          <div class="inspector-tab-pane ${activeTab === 'market' ? 'active' : ''}" id="pane-market">
            ${this.renderMarketTab(market, data)}
          </div>
          <div class="inspector-tab-pane ${activeTab === 'raw' ? 'active' : ''}" id="pane-raw">
            ${this.renderRawTab(data)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render top metrics ribbon (DPS, Defences, Unique Tier, Market).
   */
  renderMetricsRibbon(analysis = {}, market = null, properties = {}) {
    const chips = [];

    // Unique Tier
    if (analysis.unique && analysis.unique.isUnique) {
      const tier = analysis.unique.tier;
      const isRecognized = analysis.unique.recognized;
      const tierBadge = isRecognized ? `Tier ${tier}` : 'Drop Tier ?';
      const tierColor = tier === '0' ? '#ff3b30' : tier === '1' ? '#f59e0b' : '#94a3b8';
      chips.push(`
        <div class="metric-chip" style="border-color: ${tierColor};">
          <span class="metric-chip-label">Unique Drop</span>
          <strong class="metric-chip-val" style="color: ${tierColor};"><i class="fa-solid fa-crown"></i> ${this.escapeHtml(tierBadge)}</strong>
        </div>
      `);
    }

    // Weapon DPS
    if (analysis.dps && analysis.dps.isWeapon) {
      chips.push(`
        <div class="metric-chip weapon-dps-chip">
          <span class="metric-chip-label">Total DPS</span>
          <strong class="metric-chip-val text-gold">${analysis.dps.totalDps}</strong>
          <span class="metric-chip-sub">pDPS: ${analysis.dps.physicalDps} | eDPS: ${analysis.dps.elementalDps}${analysis.dps.chaosDps > 0 ? ` | cDPS: ${analysis.dps.chaosDps}` : ''}</span>
        </div>
      `);
    }

    // Defences
    const hasDef = properties.armour > 0 || properties.evasion > 0 || properties.energyShield > 0 || properties.ward > 0;
    if (hasDef) {
      const parts = [];
      if (properties.armour > 0) parts.push(`AR: ${this.formatNumber(properties.armour)}`);
      if (properties.evasion > 0) parts.push(`EV: ${this.formatNumber(properties.evasion)}`);
      if (properties.energyShield > 0) parts.push(`ES: ${this.formatNumber(properties.energyShield)}`);
      if (properties.ward > 0) parts.push(`Ward: ${this.formatNumber(properties.ward)}`);
      chips.push(`
        <div class="metric-chip defence-chip">
          <span class="metric-chip-label">Phòng ngự</span>
          <strong class="metric-chip-val">${parts.join(' · ')}</strong>
          ${properties.quality > 0 ? `<span class="metric-chip-sub text-emerald">+${properties.quality}% Quality</span>` : ''}
        </div>
      `);
    }

    // Affix Crafting Capacity
    if (analysis.affixCapacity && analysis.affixCapacity.canCraft) {
      const { openPrefixes, openSuffixes, maxPrefixes, maxSuffixes, prefixesCount, suffixesCount } = analysis.affixCapacity;
      const totalOpen = openPrefixes + openSuffixes;
      chips.push(`
        <div class="metric-chip capacity-chip ${totalOpen > 0 ? 'has-slots' : 'full-slots'}">
          <span class="metric-chip-label">Crafting Slots</span>
          <strong class="metric-chip-val">${totalOpen > 0 ? `Còn trống ${totalOpen} slot` : 'Đầy slot (6/6)'}</strong>
          <span class="metric-chip-sub">P: ${prefixesCount}/${maxPrefixes} (${openPrefixes} trống) · S: ${suffixesCount}/${maxSuffixes} (${openSuffixes} trống)</span>
        </div>
      `);
    }

    if (chips.length === 0) return '';
    return `<div class="inspector-metrics-ribbon">${chips.join('')}</div>`;
  },

  /**
   * Render Affixes & Crafting tab panel.
   */
  /**
   * Render Affixes & Crafting tab panel in authentic Exile-UI compact bar format.
   */
  renderAffixesTab(analysis = {}, identity = {}, properties = {}, market = null) {
    const isUnique = (identity.rarity || '').toLowerCase() === 'unique' || !!(analysis.unique && analysis.unique.isUnique);
    const explicits = analysis.mods || [];
    const implicits = analysis.implicits || [];
    const fractured = analysis.fractured || [];
    const crafted = analysis.crafted || [];
    const capacity = analysis.affixCapacity || null;

    let html = '<div class="exile-affix-container">';

    // 1. Exile-UI Base Defences & Requirements Row (Image 2 format)
    const hasDef = properties.armour > 0 || properties.evasion > 0 || properties.energyShield > 0 || properties.ward > 0;
    const dps = analysis.dps;

    if (hasDef || (dps && dps.isWeapon) || properties.itemLevel) {
      const ilvl = properties.itemLevel || 1;
      const maxIlvl = 86;
      const baseRollPct = (analysis.base && typeof analysis.base.baseDefencePercentile === 'number')
        ? Math.round(analysis.base.baseDefencePercentile * 100)
        : null;

      html += `
        <div class="exile-base-row">
          <div class="exile-base-cell exile-base-title">BASE</div>
          ${properties.armour > 0 ? `
            <div class="exile-base-cell" title="Armour: ${properties.armour}">
              <img src="/img/item-info/armor.png" class="exile-base-icon" alt="Armour">
              <span>${this.formatNumber(properties.armour)}</span>
            </div>
          ` : ''}
          ${properties.evasion > 0 ? `
            <div class="exile-base-cell" title="Evasion: ${properties.evasion}">
              <img src="/img/item-info/evasion.png" class="exile-base-icon" alt="Evasion">
              <span>${this.formatNumber(properties.evasion)}</span>
            </div>
          ` : ''}
          ${properties.energyShield > 0 ? `
            <div class="exile-base-cell" title="Energy Shield: ${properties.energyShield}">
              <img src="/img/item-info/energy.png" class="exile-base-icon" alt="ES">
              <span>${this.formatNumber(properties.energyShield)}</span>
            </div>
          ` : ''}
          ${properties.armour > 0 && properties.evasion > 0 ? `
            <div class="exile-base-cell" title="Hybrid Armour/Evasion">
              <img src="/img/item-info/armor_evasion.png" class="exile-base-icon" alt="AR/EV">
              <span>${baseRollPct !== null ? `${baseRollPct}%` : '83%'}</span>
            </div>
          ` : ''}
          ${properties.armour > 0 && properties.energyShield > 0 ? `
            <div class="exile-base-cell" title="Hybrid Armour/Energy Shield">
              <img src="/img/item-info/armor_energy.png" class="exile-base-icon" alt="AR/ES">
              <span>${baseRollPct !== null ? `${baseRollPct}%` : '100%'}</span>
            </div>
          ` : ''}
          ${properties.evasion > 0 && properties.energyShield > 0 ? `
            <div class="exile-base-cell" title="Hybrid Evasion/Energy Shield">
              <img src="/img/item-info/evasion_energy.png" class="exile-base-icon" alt="EV/ES">
              <span>${baseRollPct !== null ? `${baseRollPct}%` : '100%'}</span>
            </div>
          ` : ''}
          ${baseRollPct !== null ? `
            <div class="exile-base-cell cell-highlight" title="Base Defence Percentile">
              <img src="/img/item-info/defense.png" class="exile-base-icon" alt="Defence">
              <span>${baseRollPct}%</span>
            </div>
          ` : ''}
          ${dps && dps.isWeapon ? `
            <div class="exile-base-cell cell-highlight" title="Total DPS">
              <img src="/img/item-info/damage.png" class="exile-base-icon" alt="DPS">
              <span>${dps.totalDps}</span>
            </div>
          ` : ''}
          ${properties.quality > 0 ? `
            <div class="exile-base-cell" title="Quality">
              <img src="/img/item-info/scraps.png" class="exile-base-icon" alt="Quality">
              <span>+${properties.quality}%</span>
            </div>
          ` : ''}
          <div class="exile-base-cell exile-ilvl-cell" title="Item Level">
            <img src="/img/item-info/ilvl.png" class="exile-base-icon" alt="iLvl">
            <span class="${ilvl >= 84 ? 'ilvl-high' : ''}">${ilvl}/${maxIlvl}</span>
          </div>
        </div>
      `;
    }

    // 2. Exile-UI Mod Bars List
    html += '<div class="exile-affix-list">';

    // Implicits
    if (implicits.length > 0) {
      for (const m of implicits) {
        html += this.renderExileModBar(m, 'implicit', isUnique);
      }
      if (fractured.length > 0 || explicits.length > 0 || crafted.length > 0) {
        html += '<div class="exile-mod-divider"></div>';
      }
    }

    // Fractured
    for (const m of fractured) {
      html += this.renderExileModBar(m, 'fractured', isUnique);
    }

    // Explicits (split into Prefixes and Suffixes if matched)
    if (!isUnique && explicits.some(m => m.type === 'prefix') && explicits.some(m => m.type === 'suffix')) {
      const prefixes = explicits.filter(m => m.type === 'prefix');
      const suffixes = explicits.filter(m => m.type === 'suffix');
      const others = explicits.filter(m => m.type !== 'prefix' && m.type !== 'suffix');

      for (const m of prefixes) {
        html += this.renderExileModBar(m, 'explicit', isUnique);
      }
      html += '<div class="exile-mod-divider affix-split"></div>';
      for (const m of suffixes) {
        html += this.renderExileModBar(m, 'explicit', isUnique);
      }
      for (const m of others) {
        html += this.renderExileModBar(m, 'explicit', isUnique);
      }
    } else {
      for (const m of explicits) {
        html += this.renderExileModBar(m, 'explicit', isUnique);
      }
    }

    // Crafted
    for (const m of crafted) {
      html += this.renderExileModBar(m, 'crafted', isUnique);
    }

    html += '</div>';

    // 3. Exile-UI Bottom Summary Bar
    if (isUnique) {
      const dropTier = analysis.unique?.tier ?? '?';
      const overallScore = this.calculateOverallUniqueScore(analysis);
      const tierClass = dropTier === '0' ? 'tier-0' : dropTier === '1' ? 'tier-1' : dropTier === '2' ? 'tier-2' : dropTier === '3' ? 'tier-3' : 'tier-4';
      html += `
        <div class="exile-footer-bar">
          <div class="exile-footer-left">
            <span class="exile-drop-tier-pill ${tierClass}">T${dropTier} UNIQUE</span>
          </div>
          <div class="exile-footer-right">
            <span>ROLL SCORE:</span>
            <span class="exile-unique-badge pct-${overallScore >= 80 ? 'high' : overallScore >= 50 ? 'med' : 'low'}">${overallScore}%</span>
          </div>
        </div>
      `;
    } else if (capacity && capacity.canCraft) {
      const { openPrefixes, openSuffixes, maxPrefixes, maxSuffixes, prefixesCount, suffixesCount } = capacity;
      html += `
        <div class="exile-footer-bar crafting-summary-banner">
          <div class="exile-footer-left">
            <span>CRAFTING:</span>
            <span class="text-emerald font-bold">P: ${prefixesCount}/${maxPrefixes} (${openPrefixes} Trống) · S: ${suffixesCount}/${maxSuffixes} (${openSuffixes} Trống)</span>
          </div>
          <div class="exile-footer-right">
            <span>${openPrefixes > 0 || openSuffixes > 0 ? 'Có thể Bench Craft' : 'Đầy slot'}</span>
          </div>
        </div>
      `;
    }

    // 4. Market Reference Strip
    if (market) {
      html += `
        <div class="exile-market-strip">
          <div class="exile-market-val">
            <span>Thị trường (${this.escapeHtml(market.league || 'Standard')}):</span>
            <strong>${market.divineValue >= 1 ? `${market.divineValue} Divine` : `${market.chaosValue} Chaos`}</strong>
            ${market.variant ? `<span class="text-muted">(${this.escapeHtml(market.variant)})</span>` : ''}
          </div>
          <div class="exile-market-links">
            ${market.sparkline ? `<span class="sparkline-pill">7d Trend: ${market.sparkline.totalChange || 0}%</span>` : ''}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * Renders a single Exile-UI authentic mod row with visualized progress bar, tier box, and icon.
   */
  renderExileModBar(mod, group = 'explicit', isUnique = false) {
    const tier = mod.tier;
    const isMatched = mod.status === 'matched';
    const roll = (mod.rollAnalysis && mod.rollAnalysis[0]) ? mod.rollAnalysis[0] : null;
    let pct = roll && typeof roll.percentile === 'number' ? Math.round(roll.percentile * 100) : null;

    // Fallback: calculate percentage directly from raw text if value(min-max) exists
    if (pct === null) {
      const match = (mod.text || '').match(/\b(\d+(?:\.\d+)?)\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*(?:-|to)\s*([+-]?\d+(?:\.\d+)?)\s*\)/);
      if (match) {
        const val = parseFloat(match[1]);
        const min = parseFloat(match[2]);
        const max = parseFloat(match[3]);
        if (max > min) {
          pct = Math.round(((val - min) / (max - min)) * 100);
          pct = Math.max(0, Math.min(100, pct));
        } else if (max === min) {
          pct = 100;
        }
      }
    }

    const formattedText = this.formatExileModText(mod);
    const fillStyle = pct !== null ? `style="width: ${pct}%;"` : '';

    let rowClass = `exile-mod-row mod-${group}`;
    if (isUnique) rowClass += ' mod-unique';

    // 1. Resolve Exile-UI PNG Icon
    const iconName = mod.icon || this.resolveExileIcon(mod.text, mod.tags, mod.family);
    const iconHtml = iconName
      ? `<div class="exile-icon-box"><img src="/img/item-info/${this.escapeHtml(iconName)}.png" class="exile-mod-icon" alt="${this.escapeHtml(iconName)}" onerror="this.parentElement.style.display='none'"></div>`
      : '';

    // 2. Resolve Tier Box and Colors
    let tierHtml = '';
    let indicatorClass = 'indicator-neutral';

    if (isUnique) {
      const scoreVal = pct !== null ? pct : (mod.values && mod.values[0] ? mod.values[0].value : '-');
      const scoreClass = pct === 100 ? 'tier-t1-white' : (pct >= 75 ? 'tier-t3' : (pct >= 45 ? 'tier-t4' : 'tier-t5'));
      tierHtml = `<div class="exile-tier-box tier-badge ${scoreClass}">${scoreVal}</div>`;
      if (pct !== null && pct >= 80) indicatorClass = 'indicator-good';
    } else if (group === 'implicit') {
      const impLabel = typeof tier === 'string' ? tier.slice(0, 4).toUpperCase() : (tier ? `T${tier}` : 'IMP');
      const impClass = (typeof tier === 'string' && /greater|grand|perfect|exquisite/i.test(tier)) ? 'tier-t1' : 'tier-imp';
      tierHtml = `<div class="exile-tier-box tier-badge ${impClass}" title="${this.escapeHtml(mod.tierName || 'Implicit')}">${impLabel}</div>`;
    } else if (group === 'crafted') {
      tierHtml = `<div class="exile-tier-box tier-badge tier-craft" title="Bench Crafted">CRAFT</div>`;
    } else if (group === 'fractured') {
      tierHtml = `<div class="exile-tier-box tier-badge tier-frac" title="Fractured Mod">FRAC</div>`;
      indicatorClass = 'indicator-good';
    } else if (tier) {
      const tierNum = typeof tier === 'number' ? tier : parseInt(tier, 10);
      let tierColorClass = 'tier-tnone';
      if (tierNum === 1) {
        tierColorClass = (pct !== null && pct >= 90) ? 'tier-t1-white' : 'tier-t1';
        indicatorClass = 'indicator-good';
      } else if (tierNum === 2) {
        tierColorClass = 'tier-t2';
        indicatorClass = 'indicator-good';
      } else if (tierNum === 3) {
        tierColorClass = 'tier-t3';
      } else if (tierNum === 4) {
        tierColorClass = 'tier-t4';
      } else if (tierNum === 5) {
        tierColorClass = 'tier-t5';
      } else if (tierNum >= 6) {
        tierColorClass = 'tier-t6';
      }
      const label = typeof tier === 'number' ? `T${tier}` : tier;
      tierHtml = `<div class="exile-tier-box tier-badge ${tierColorClass}" title="T${tier} - ${this.escapeHtml(mod.tierName || `Tier ${tier}`)}" data-tier="T${tier}">${label}</div>`;
    } else if (mod.tierName === 'Essences' || (mod.tags && mod.tags.includes('Essence'))) {
      tierHtml = `<div class="exile-tier-box tier-badge tier-essence" title="Essence Mod">ESS</div>`;
      indicatorClass = 'indicator-good';
    } else {
      tierHtml = `<div class="exile-tier-box tier-badge tier-tnone">-</div>`;
    }

    const fillClass = isUnique ? 'fill-unique' : (group === 'implicit' ? 'fill-implicit' : (group === 'crafted' ? 'fill-crafted' : 'fill-rare'));

    return `
      <div class="${rowClass}">
        <div class="exile-mod-bar roll-track">
          ${pct !== null ? `<div class="exile-mod-fill roll-bar-fill ${fillClass}" ${fillStyle}></div>` : ''}
          <div class="exile-mod-text" title="${this.escapeHtml(mod.text)}">${this.escapeHtml(formattedText)}</div>
        </div>
        <div class="exile-mod-indicator ${indicatorClass}"></div>
        ${tierHtml}
        ${iconHtml}
      </div>
    `;
  },

  formatExileModText(mod) {
    let text = (mod.text || '').trim();
    if (/\(\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/.test(text)) {
      return text.toUpperCase();
    }
    const rolls = mod.rollAnalysis || [];
    if (rolls.length > 0) {
      for (const r of rolls) {
        if (r.value !== null && r.min !== null && r.max !== null && r.min !== r.max) {
          const valRegex = new RegExp(`(?<![\\(\\d])\\b${r.value}\\b(?![\\)\\d])`);
          text = text.replace(valRegex, `${r.value}(${r.min}-${r.max})`);
        }
      }
    }
    return text.toUpperCase();
  },

  resolveExileIcon(text = '', tags = [], family = '') {
    const str = (text || '').toLowerCase();
    const fam = (family || '').toLowerCase();
    const tagList = Array.isArray(tags) ? tags.map(t => (t || '').toLowerCase()) : [];

    // Specific attacks
    if (str.includes('adds ') && str.includes('damage') && !str.includes('spells')) {
      if (str.includes('fire')) return 'fire_attack';
      if (str.includes('cold')) return 'cold_attack';
      if (str.includes('lightning')) return 'lightning_attack';
      if (str.includes('chaos')) return 'chaos_attack';
      if (str.includes('physical')) return 'phys';
    }

    // Minion / Totem / Flasks / Gems
    if (str.includes('minion') || tagList.includes('minion')) return 'minion';
    if (str.includes('totem')) return 'totems';
    if (str.includes('flask')) return 'flasks';
    if (str.includes('to level of ') && str.includes('gem')) return 'gem_level';

    // Accuracy / Crit / Speed
    if (str.includes('accuracy rating')) return 'accuracy';
    if (str.includes('critical') || str.includes('crit')) return 'crit';
    if (str.includes('attack speed') || str.includes('cast speed') || str.includes('movement speed') || tagList.includes('speed')) return 'speed';

    // Resistances
    if (str.includes('all elemental resistances') || str.includes('all maximum resistances')) return 'allres';
    if (str.includes('fire resistance') || str.includes('fire and') || (tagList.includes('fire') && str.includes('resistance'))) return 'fire';
    if (str.includes('cold resistance') || str.includes('cold and') || (tagList.includes('cold') && str.includes('resistance'))) return 'cold';
    if (str.includes('lightning resistance') || str.includes('lightning and') || (tagList.includes('lightning') && str.includes('resistance'))) return 'lightning';
    if (str.includes('chaos resistance') || (tagList.includes('chaos') && str.includes('resistance'))) return 'chaos';

    // Life & Mana
    if (str.includes('maximum life') || str.includes('to life') || tagList.includes('life')) {
      if (str.includes('regenerate') || str.includes('regeneration')) return 'life_regen';
      return 'life';
    }
    if (str.includes('regenerate') && str.includes('life')) return 'life_regen';

    if (str.includes('maximum mana') || str.includes('to mana') || tagList.includes('mana')) {
      if (str.includes('regenerate') || str.includes('regeneration')) return 'mana_regen';
      return 'mana';
    }
    if (str.includes('regenerate') && str.includes('mana')) return 'mana_regen';

    // Attributes / Stats
    if (str.includes('all attributes') || str.includes('increased attributes')) return 'allstats';
    if (str.includes('strength') && str.includes('dexterity') && str.includes('intelligence')) return 'allstats';
    if (str.includes('to strength') || str.includes('strength')) return 'strength';
    if (str.includes('to dexterity') || str.includes('dexterity')) return 'dexterity';
    if (str.includes('to intelligence') || str.includes('intelligence')) return 'intelligence';

    // Defences
    if (str.includes('armour and evasion') || (str.includes('armour') && str.includes('evasion rating'))) return 'armor_evasion';
    if (str.includes('armour and energy') || (str.includes('armour') && str.includes('energy shield'))) return 'armor_energy';
    if (str.includes('evasion and energy') || (str.includes('evasion') && str.includes('energy shield'))) return 'evasion_energy';
    if (str.includes('armour')) return 'armor';
    if (str.includes('evasion')) return 'evasion';
    if (str.includes('energy shield')) return 'energy';
    if (str.includes('ward')) return 'ward';
    if (str.includes('suppress spell damage') || str.includes('suppressed')) return 'defense';
    if (str.includes('block')) return 'block';

    // Damage
    if (str.includes('fire damage') || tagList.includes('fire')) return 'fire_damage';
    if (str.includes('cold damage') || tagList.includes('cold')) return 'cold_damage';
    if (str.includes('lightning damage') || tagList.includes('lightning')) return 'lightning_damage';
    if (str.includes('chaos damage') || tagList.includes('chaos')) return 'chaos_damage';
    if (str.includes('physical damage') || str.includes('global physical')) return 'phys';
    if (str.includes('spell damage')) return 'spell_damage';
    if (str.includes('increased damage')) return 'damage';

    // Eldritch / Special
    if (str.includes('searing exarch') || str.includes('exarch')) return 'exarch';
    if (str.includes('eater of worlds') || str.includes('eater')) return 'eater';
    if (str.includes('essence') || tagList.includes('essence')) return 'essence';
    if (str.includes('crafted') || str.includes('master')) return 'mastercraft';
    if (str.includes('delve')) return 'delve';
    if (str.includes('incursion')) return 'incursion';
    if (str.includes('syndicate') || str.includes('veiled')) return 'syndicate';
    if (str.includes('synthesis')) return 'synthesis';
    if (str.includes('vaal')) return 'vaal';

    if (fam.includes('life')) return 'life';
    if (fam.includes('fire')) return 'fire';
    if (fam.includes('cold')) return 'cold';
    if (fam.includes('lightning')) return 'lightning';
    if (fam.includes('chaos')) return 'chaos';
    if (fam.includes('speed')) return 'speed';
    if (fam.includes('mana')) return 'mana';
    if (fam.includes('armour') || fam.includes('evasion') || fam.includes('energy') || fam.includes('defence')) return 'defense';

    return null;
  },

  calculateOverallUniqueScore(analysis = {}) {
    const mods = [
      ...(analysis.implicits || []),
      ...(analysis.mods || [])
    ];
    const validRolls = [];
    for (const m of mods) {
      if (m.rollAnalysis) {
        for (const r of m.rollAnalysis) {
          if (typeof r.percentile === 'number') {
            validRolls.push(r.percentile);
          }
        }
      }
    }
    if (validRolls.length === 0) return 50;
    const avg = validRolls.reduce((a, b) => a + b, 0) / validRolls.length;
    return Math.round(avg * 100);
  },

  /**
   * Render single mod card with tier badge and roll progress bar.
   */
  renderModRow(mod, group = 'explicit') {
    const isAmbiguous = mod.status === 'ambiguous';
    const isMatched = mod.status === 'matched';
    const tier = mod.tier;
    const tierName = mod.tierName;
    const tierClass = tier ? (tier === 1 ? 'tier-t1' : tier === 2 ? 'tier-t2' : tier === 3 ? 'tier-t3' : 'tier-t4') : 'tier-none';

    const rollBars = (mod.rollAnalysis || []).map(r => {
      if (r.percentile === null || r.min === null || r.max === null) return '';
      const pct = Math.round(r.percentile * 100);
      const isMaxRoll = pct >= 100;
      const isMinRoll = pct <= 0;

      return `
        <div class="roll-bar-wrapper">
          <span class="roll-bound roll-min">${r.min}</span>
          <div class="roll-track" title="Roll: ${r.value} trong khoảng [${r.min}, ${r.max}] (${pct}%)">
            <div class="roll-bar-fill ${isMaxRoll ? 'perfect-roll' : ''}" style="width: ${pct}%;"></div>
            <div class="roll-thumb" style="left: ${pct}%;"></div>
          </div>
          <span class="roll-bound roll-max">${r.max}</span>
          <span class="roll-percentile-pill ${isMaxRoll ? 'pill-perfect' : isMinRoll ? 'pill-min' : ''}">${r.display || `${pct}%`}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="mod-card ${tierClass} ${group}-mod-card">
        <div class="mod-card-header">
          <div class="mod-badge-group">
            ${tier ? `<span class="tier-badge ${tierClass}" title="Bậc Tier ${tier}${tierName ? ` (${tierName})` : ''}">T${tier}</span>` : ''}
            ${mod.family ? `<span class="mod-family-name">${this.escapeHtml(mod.family)}</span>` : ''}
            ${isAmbiguous ? `<span class="ambiguous-badge" title="Affix có thể thuộc nhiều họ mod khác nhau"><i class="fa-solid fa-triangle-exclamation"></i> Nhập nhằng</span>` : ''}
          </div>
          ${mod.requiredItemLevel ? `<span class="mod-req-lvl">iLvl ${mod.requiredItemLevel}+</span>` : ''}
        </div>
        <div class="mod-text">${this.escapeHtml(mod.text)}</div>
        ${rollBars ? `<div class="mod-roll-container">${rollBars}</div>` : ''}
      </div>
    `;
  },

  /**
   * Render Crafting Capacity Banner.
   */
  renderCraftingCapacityBanner(capacity) {
    const { openPrefixes, openSuffixes, canCraft, isAffixCountPrecise, hasUncertainAffixes } = capacity;
    const canBench = openPrefixes > 0 || openSuffixes > 0;

    return `
      <div class="crafting-summary-banner ${canBench ? 'can-bench' : 'cannot-bench'}">
        <div class="crafting-banner-icon">
          <i class="fa-solid ${canBench ? 'fa-screwdriver-wrench' : 'fa-ban'}"></i>
        </div>
        <div class="crafting-banner-info">
          <div class="crafting-banner-title">
            ${canBench ? 'Có thể chế tạo thêm dòng (Crafting Available)' : 'Vật phẩm đã đầy slot thuộc tính'}
          </div>
          <div class="crafting-banner-desc">
            ${canBench ? `Bạn có thể dùng Bench Craft hoặc Exalted Orb để thêm: <strong>${openPrefixes > 0 ? `${openPrefixes} Prefix` : ''}${openPrefixes > 0 && openSuffixes > 0 ? ' và ' : ''}${openSuffixes > 0 ? `${openSuffixes} Suffix` : ''}</strong>` : 'Đã đạt tối đa 3 Prefixes và 3 Suffixes.'}
          </div>
          ${hasUncertainAffixes ? `<div class="crafting-uncertain-warning"><i class="fa-solid fa-triangle-exclamation"></i> Vật phẩm chứa mod chưa xác định rõ họ, số slot trên là ước lượng.</div>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render Combat & Defences tab.
   */
  renderCombatTab(analysis = {}, properties = {}, identity = {}) {
    let html = '';

    // Weapon Combat Block
    if (analysis.dps && analysis.dps.isWeapon) {
      const d = analysis.dps;
      const q = d.qualityScaling || {};

      html += `
        <div class="combat-block weapon-combat-block">
          <h3 class="combat-block-title"><i class="fa-solid fa-swords"></i> Chỉ số sát thương vũ khí (Weapon DPS)</h3>
          <div class="combat-grid">
            <div class="combat-card total-dps-card">
              <span class="combat-card-label">Total DPS</span>
              <strong class="combat-card-val">${d.totalDps}</strong>
              <span class="combat-card-sub">Tổng hợp tất cả nguồn sát thương</span>
            </div>
            <div class="combat-card">
              <span class="combat-card-label">Physical DPS (pDPS)</span>
              <strong class="combat-card-val text-phys">${d.physicalDps}</strong>
              <span class="combat-card-sub">Crit: ${properties.criticalChance || 5.0}% · APS: ${d.aps}</span>
            </div>
            <div class="combat-card">
              <span class="combat-card-label">Elemental DPS (eDPS)</span>
              <strong class="combat-card-val text-elem">${d.elementalDps}</strong>
              <span class="combat-card-sub">${(d.elementalBreakdown || []).map(b => `${b.type.toUpperCase()}: ${b.dps}`).join(' · ') || 'None'}</span>
            </div>
            ${d.chaosDps > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Chaos DPS (cDPS)</span>
                <strong class="combat-card-val text-chaos">${d.chaosDps}</strong>
                <span class="combat-card-sub">Sát thương hỗn mang</span>
              </div>
            ` : ''}
          </div>

          <!-- Quality Projection (Estimated Approximation) -->
          <div class="quality-projection-card">
            <div class="quality-proj-header">
              <span><i class="fa-solid fa-arrow-trend-up"></i> Ước tính tăng tiến theo Quality (Blacksmith's Whetstone · Estimated 20% Quality DPS)</span>
              <span class="current-q">Hiện tại: +${d.quality}% Quality</span>
            </div>
            <div class="quality-proj-row">
              <div class="q-metric">
                <span class="q-label">Tại 0% Quality:</span>
                <strong class="q-val">${q.physicalDpsAt0Quality || d.physicalDps} pDPS</strong>
              </div>
              <div class="q-arrow"><i class="fa-solid fa-angles-right"></i></div>
              <div class="q-metric">
                <span class="q-label">Ước tính tại 20% Quality:</span>
                <strong class="q-val text-emerald">${q.physicalDpsAt20Quality || d.physicalDps} pDPS</strong>
                <span class="q-sub">(Total: ~${q.totalDpsAt20Quality || d.totalDps} DPS · ước lượng)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Armour / Defences Block
    const base = analysis.base || {};
    const hasDef = properties.armour > 0 || properties.evasion > 0 || properties.energyShield > 0 || properties.ward > 0;

    if (hasDef || base.baseDefences) {
      html += `
        <div class="combat-block defence-combat-block">
          <h3 class="combat-block-title"><i class="fa-solid fa-shield"></i> Chỉ số phòng ngự (Defences)</h3>
          <div class="combat-grid">
            ${properties.armour > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Armour</span>
                <strong class="combat-card-val">${this.formatNumber(properties.armour)}</strong>
                ${base.baseDefences?.armour ? `<span class="combat-card-sub">Gốc: ${base.baseDefences.armour.min}–${base.baseDefences.armour.max}</span>` : ''}
              </div>
            ` : ''}
            ${properties.evasion > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Evasion Rating</span>
                <strong class="combat-card-val">${this.formatNumber(properties.evasion)}</strong>
                ${base.baseDefences?.evasion ? `<span class="combat-card-sub">Gốc: ${base.baseDefences.evasion.min}–${base.baseDefences.evasion.max}</span>` : ''}
              </div>
            ` : ''}
            ${properties.energyShield > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Energy Shield</span>
                <strong class="combat-card-val text-es">${this.formatNumber(properties.energyShield)}</strong>
                ${base.baseDefences?.energyShield ? `<span class="combat-card-sub">Gốc: ${base.baseDefences.energyShield.min}–${base.baseDefences.energyShield.max}</span>` : ''}
              </div>
            ` : ''}
            ${properties.ward > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Ward</span>
                <strong class="combat-card-val">${this.formatNumber(properties.ward)}</strong>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Requirements & Base Specs
    const reqs = properties.requirements || base.requirements?.item || {};
    html += `
      <div class="combat-block req-combat-block">
        <h3 class="combat-block-title"><i class="fa-solid fa-list-check"></i> Yêu cầu trang bị &amp; Base Item</h3>
        <div class="req-tags-row">
          ${reqs.level ? `<span class="req-tag">Level: <strong>${reqs.level}</strong></span>` : ''}
          ${reqs.str ? `<span class="req-tag text-str">Str: <strong>${reqs.str}</strong></span>` : ''}
          ${reqs.dex ? `<span class="req-tag text-dex">Dex: <strong>${reqs.dex}</strong></span>` : ''}
          ${reqs.int ? `<span class="req-tag text-int">Int: <strong>${reqs.int}</strong></span>` : ''}
          ${base.dropLevel ? `<span class="req-tag">Drop Level: <strong>${base.dropLevel}</strong></span>` : ''}
        </div>
      </div>
    `;

    return html || '<div class="inspector-empty-state"><p>Không có dữ liệu chiến đấu cho trang bị này.</p></div>';
  },

  /**
   * Render Market & Valuation tab.
   */
  renderMarketTab(market = null, fullData = {}) {
    if (!market) {
      return `
        <div class="inspector-empty-state">
          <i class="fa-solid fa-store-slash" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;"></i>
          <p>Chưa có dữ liệu thị trường poe.ninja cho vật phẩm này trong League hiện tại.</p>
          <span class="text-muted text-xs">Chỉ số này phụ thuộc vào phân loại vật phẩm (Uniques, Currency, BaseTypes...)</span>
        </div>
      `;
    }

    const isDivineMajor = market.divineValue >= 1;
    const ninjaUrl = `https://poe.ninja/${market.game || 'poe1'}/economy/${encodeURIComponent(market.league || 'Standard')}/${encodeURIComponent(market.sourceType || 'currency')}?name=${encodeURIComponent(market.name)}`;

    return `
      <div class="market-tab-content">
        <div class="market-valuation-card">
          <div class="market-val-header">
            <div>
              <div class="market-item-title">${this.escapeHtml(market.name)}</div>
              <div class="market-league-crumb"><i class="fa-solid fa-earth-americas"></i> League: <strong>${this.escapeHtml(market.league || 'Standard')}</strong></div>
            </div>
            <a href="${ninjaUrl}" target="_blank" rel="noopener" class="btn-ninja-link">
              poe.ninja ↗
            </a>
          </div>

          <div class="market-price-big">
            <span class="price-main">${isDivineMajor ? `${market.divineValue} Divine` : `${market.chaosValue} Chaos`}</span>
            <span class="price-sub">≈ ${isDivineMajor ? `${market.chaosValue} Chaos` : `${market.divineValue} Divine`}</span>
          </div>

          ${market.isBaseReference ? `
            <div class="market-reference-banner">
              <i class="fa-solid fa-circle-info"></i>
              <span><strong>Tham chiếu giá base item (Base item reference)</strong>: Đây là giá thị trường của base item / phôi đồ trên poe.ninja, không phải định giá toàn bộ thuộc tính affix của trang bị này.</span>
            </div>
          ` : ''}

          ${market.variant ? `<div class="market-variant-note"><i class="fa-solid fa-tags"></i> Biến thể (Variant): <strong>${this.escapeHtml(market.variant)}</strong></div>` : ''}

          ${((market.count !== null && market.count !== undefined) || (market.volume !== null && market.volume !== undefined)) ? `
            <div class="market-volume-note"><i class="fa-solid fa-box-archive"></i> Số lượng / Volume niêm yết: <strong>${this.formatNumber(market.count ?? market.volume)}</strong></div>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render Raw Text tab.
   */
  renderRawTab(data = {}) {
    const rawText = data.rawText || '';
    return `
      <div class="raw-tab-content">
        <div class="raw-tab-header">
          <span>Nội dung clipboard Path of Exile gốc:</span>
          <button class="btn-copy-raw-text" id="btnCopyRawInspector" title="Sao chép toàn bộ văn bản">
            <i class="fa-solid fa-copy"></i> Sao chép
          </button>
        </div>
        <pre class="raw-item-pre" id="rawItemPreContent">${this.escapeHtml(rawText)}</pre>
      </div>
    `;
  }
};
